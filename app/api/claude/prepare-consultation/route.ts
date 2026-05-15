import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callClaudeJson } from "@/lib/anthropic";
import {
  buildPromptContext,
  CONSULTATION_PREP_PROMPT,
  interpolate,
  type ConsultationPrepResult,
} from "@/lib/prompts";

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
    consultation_type,
    doctor_name: doctor_name ?? "non précisé",
    hospital: hospital ?? "non précisé",
    consultation_date: consultation_date ?? "non précisée",
  };

  const system = interpolate(CONSULTATION_PREP_PROMPT, ctx) + buildKnowledgeContextBlock(kb);

  try {
    const result = await callClaudeJson<ConsultationPrepResult>({
      model: "claude-haiku-4-5-20251001",
      system,
      user: `Génère la préparation JSON pour la consultation ${consultation_type}${doctor_name ? ` avec ${doctor_name}` : ""}.`,
      max_tokens: 16384,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Claude";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
