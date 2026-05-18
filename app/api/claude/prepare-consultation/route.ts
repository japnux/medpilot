import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callClaudeJson } from "@/lib/anthropic";
import { logApiUsage } from "@/lib/usage-tracker";
import { buildToneInstructions } from "@/lib/tone";
import { getToneForUser } from "@/lib/tone-server";
import {
  buildPromptContext,
  CONSULTATION_PREP_PROMPT,
  interpolate,
  type ConsultationPrepResult,
} from "@/lib/prompts";
import { buildSymptomContext } from "@/lib/symptom-context";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({
  family_id: z.string().uuid(),
  consultation_type: z.string().min(1),
  consultation_date: z.string().optional(),
  doctor_name: z.string().optional(),
  hospital: z.string().optional(),
  open_points: z.string().optional(),
  treatment_context: z.string().optional(),
  /** Si fourni, on injecte spécifiquement les décisions awaiting_team
   * liées à cette consultation (sync M3 ↔ Décisions). */
  consultation_id: z.string().uuid().optional(),
});

/**
 * POST /api/claude/prepare-consultation
 *
 * Génère une préparation de RDV via Claude Haiku 4.5 avec un contexte riche :
 *  - Profil patient + KB du cancer
 *  - 10 derniers événements timeline
 *  - 5 derniers documents analysés (résumé famille)
 *  - Bilan biologique récent (valeurs en warning/critical)
 *  - Équipe médicale connue
 *  - Détails du RDV (type, médecin, hôpital, date, points en suspens)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const {
    family_id,
    consultation_type,
    consultation_date,
    doctor_name,
    hospital,
    open_points,
    treatment_context,
    consultation_id,
  } = parsed.data;

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("family_id", family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("*")
    .eq("family_id", family_id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  // Knowledge base partagée
  const { data: kb } = await supabase
    .from("cancer_knowledge_base")
    .select(
      "cancer_type_label, version, generated_at, status, expert_network, staging_classification, biomarkers, standard_protocols, surveillance_recommendations, red_flags, genetic_considerations",
    )
    .eq("cancer_type", profile.cancer_type)
    .maybeSingle();
  const { buildKnowledgeContextBlock } = await import("@/lib/knowledge-context");
  const { enrichWithMedications } = await import("@/lib/medications-context");
  const medicationsBlock = await enrichWithMedications(supabase, family_id);

  // 10 derniers événements timeline
  const { data: recent } = await supabase
    .from("timeline_events")
    .select("event_date, event_type, title, summary")
    .eq("family_id", family_id)
    .order("event_date", { ascending: false })
    .limit(10);

  const recentStr =
    recent && recent.length > 0
      ? recent
          .map(
            (e) =>
              `- ${e.event_date} [${e.event_type}] ${e.title}${e.summary ? ` — ${e.summary.slice(0, 120)}` : ""}`,
          )
          .join("\n")
      : "aucun événement récent";

  // 5 derniers documents analysés (résumé famille + doctor)
  const { data: docs } = await supabase
    .from("medical_documents")
    .select("title, document_date, document_type, doctor_name, analysis_summary")
    .eq("family_id", family_id)
    .order("document_date", { ascending: false, nullsFirst: false })
    .limit(5);

  const docsStr =
    docs && docs.length > 0
      ? docs
          .map((d) => {
            const sum =
              (d.analysis_summary as { summary_family?: string } | null)?.summary_family ??
              "";
            return `- ${d.document_date ?? "date inconnue"} [${d.document_type}] ${d.title}${d.doctor_name ? ` (${d.doctor_name})` : ""}${sum ? ` — ${sum.slice(0, 200)}` : ""}`;
          })
          .join("\n")
      : "aucun document analysé";

  // Bilan biologique récent : uniquement les valeurs hors normes
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const { data: bioAlerts } = await supabase
    .from("biology_records")
    .select("recorded_at, marker_name, value, unit, alert_level")
    .eq("family_id", family_id)
    .in("alert_level", ["warning", "critical"])
    .gte("recorded_at", oneYearAgo.toISOString().slice(0, 10))
    .order("recorded_at", { ascending: false })
    .limit(15);

  const bioAlertsStr =
    bioAlerts && bioAlerts.length > 0
      ? bioAlerts
          .map(
            (b) =>
              `- ${b.recorded_at} ${b.marker_name}: ${b.value} ${b.unit} [${b.alert_level}]`,
          )
          .join("\n")
      : "aucune valeur préoccupante récente";

  // Décisions du parcours :
  //  - awaiting_team liées à CETTE consultation : à aborder en priorité
  //  - pending (non obsolète) : à inscrire à l'ordre du jour si pertinent
  //  - decided récentes : pour que Claude ne reformule pas des questions déjà tranchées
  const { data: decisions } = await supabase
    .from("decisions")
    .select(
      "title, question, category, priority, status, chosen_option, rationale, decided_by, decided_at, due_date, source_consultation_id, team_note",
    )
    .eq("family_id", family_id)
    .in("status", ["pending", "awaiting_team", "decided"])
    .order("status", { ascending: true })
    .order("priority", { ascending: true })
    .order("decided_at", { ascending: false, nullsFirst: false })
    .limit(25);

  const all = decisions ?? [];
  const awaitingForThisConsult = consultation_id
    ? all.filter(
        (d) =>
          d.status === "awaiting_team" &&
          d.source_consultation_id === consultation_id,
      )
    : all.filter((d) => d.status === "awaiting_team");
  const pendingDec = all.filter((d) => d.status === "pending");
  const decidedDec = all.filter((d) => d.status === "decided");

  const awaitingForConsultStr =
    awaitingForThisConsult.length > 0
      ? awaitingForThisConsult
          .map(
            (d) =>
              `- ${d.title}${d.question ? ` — ${d.question}` : ""}${d.team_note ? ` (note interne : ${d.team_note})` : ""}`,
          )
          .join("\n")
      : "aucune";

  const pendingDecisionsStr =
    pendingDec.length > 0
      ? pendingDec
          .map(
            (d) =>
              `- [${d.category}/${d.priority}] ${d.title}${d.question ? ` — ${d.question}` : ""}${d.due_date ? ` (échéance ${d.due_date})` : ""}`,
          )
          .join("\n")
      : "aucune";

  const decidedDecisionsStr =
    decidedDec.length > 0
      ? decidedDec
          .map(
            (d) =>
              `- ${d.decided_at ?? "?"} ${d.title} → ${d.chosen_option}${d.rationale ? ` (${d.rationale})` : ""}${d.decided_by ? ` — par ${d.decided_by}` : ""}`,
          )
          .join("\n")
      : "aucune";

  // Équipe médicale
  const careTeam = Array.isArray(profile.care_team)
    ? (profile.care_team as Array<{ name?: string; specialty?: string; hospital?: string }>)
        .map((m) =>
          [m.name, m.specialty, m.hospital].filter(Boolean).join(" — "),
        )
        .filter(Boolean)
        .join("\n- ")
    : "";
  const careTeamStr = careTeam ? `- ${careTeam}` : "non renseignée";

  // Symptômes & effets indésirables des 14 derniers jours (top 5 + criticals)
  const symptomsStr = await buildSymptomContext(supabase, family_id, 14);

  // Contexte d'interpolation enrichi
  const baseCtx = buildPromptContext(profile);
  const ctx = {
    ...baseCtx,
    open_points: open_points ?? "aucun",
    treatment_context: treatment_context ?? "non précisé",
    recent_events: recentStr,
    recent_documents: docsStr,
    biology_alerts: bioAlertsStr,
    care_team: careTeamStr,
    pending_decisions: pendingDecisionsStr,
    decided_decisions: decidedDecisionsStr,
    awaiting_for_this_consult: awaitingForConsultStr,
    recent_symptoms: symptomsStr,
    consultation_type,
    doctor_name: doctor_name ?? "non précisé",
    hospital: hospital ?? "non précisé",
    consultation_date: consultation_date ?? "non précisée",
  };

  const tone = await getToneForUser();
  const system =
    interpolate(CONSULTATION_PREP_PROMPT, ctx) +
    buildKnowledgeContextBlock(kb) +
    medicationsBlock +
    buildToneInstructions(tone);

  const t0 = Date.now();
  try {
    const result = await callClaudeJson<ConsultationPrepResult>({
      model: "claude-haiku-4-5-20251001",
      system,
      user: `Génère la préparation JSON pour la consultation ${consultation_type}${doctor_name ? ` avec ${doctor_name}` : ""}.`,
      max_tokens: 16384,
    });
    await logApiUsage({
      endpoint: "claude/prepare-consultation",
      model: "claude-haiku-4-5-20251001",
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      family_id,
      user_id: user.id,
      duration_ms: Date.now() - t0,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Claude";
    await logApiUsage({
      endpoint: "claude/prepare-consultation",
      model: "claude-haiku-4-5-20251001",
      input_tokens: 0,
      output_tokens: 0,
      family_id,
      user_id: user.id,
      success: false,
      error_message: msg,
      duration_ms: Date.now() - t0,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
