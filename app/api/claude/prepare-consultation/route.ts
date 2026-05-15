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

const Schema = z.object({
  family_id: z.string().uuid(),
  consultation_type: z.string().min(1),
  open_points: z.string().optional(),
  treatment_context: z.string().optional(),
});

/**
 * POST /api/claude/prepare-consultation
 * Génère des questions de consultation avec Claude Haiku 4.5.
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
  const { family_id, open_points, treatment_context } = parsed.data;

  // Vérif appartenance
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

  // Knowledge base partagée du type de cancer (si dispo) — utilisée pour
  // alimenter le prompt avec red_flags, biomarqueurs, surveillance type, etc.
  const { data: kb } = await supabase
    .from("cancer_knowledge_base")
    .select(
      "cancer_type_label, version, generated_at, status, expert_network, staging_classification, biomarkers, standard_protocols, surveillance_recommendations, red_flags, genetic_considerations",
    )
    .eq("cancer_type", profile.cancer_type)
    .maybeSingle();
  const { buildKnowledgeContextBlock } = await import("@/lib/knowledge-context");

  // Charger les 10 derniers événements timeline pour contextualiser
  const { data: recent } = await supabase
    .from("timeline_events")
    .select("event_date, event_type, title")
    .eq("family_id", family_id)
    .order("event_date", { ascending: false })
    .limit(10);

  const recentStr =
    recent && recent.length > 0
      ? recent
          .map((e) => `${e.event_date} — ${e.event_type} : ${e.title}`)
          .join(" | ")
      : "aucun événement récent";

  const ctx = {
    ...buildPromptContext(profile),
    open_points: open_points ?? "aucun",
    treatment_context: treatment_context ?? "non précisé",
    recent_events: recentStr,
  };

  const system = interpolate(CONSULTATION_PREP_PROMPT, ctx) + buildKnowledgeContextBlock(kb);

  try {
    const result = await callClaudeJson<ConsultationPrepResult>({
      model: "claude-haiku-4-5-20251001",
      system,
      user: "Génère la préparation de cette consultation au format JSON.",
      max_tokens: 2048,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Claude";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
