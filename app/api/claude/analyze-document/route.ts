import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callClaudeJson } from "@/lib/anthropic";
import { logApiUsage } from "@/lib/usage-tracker";

// Claude Opus avec PDF peut prendre 30-60s : timeout généreux
export const maxDuration = 90;
export const runtime = "nodejs";
import {
  buildPromptContext,
  DOCUMENT_ANALYSIS_PROMPT,
  interpolate,
  type DocumentAnalysisResult,
} from "@/lib/prompts";

const Schema = z
  .object({
    family_id: z.string().uuid(),
    text: z.string().optional(),
    /** PDF en base64 (sans préfixe data:) si pas de texte extrait. */
    pdf_base64: z.string().optional(),
    /** Nom du fichier source pour traçage. */
    pdf_name: z.string().optional(),
  })
  .refine(
    (d) => (d.text && d.text.trim().length >= 20) || (d.pdf_base64 && d.pdf_base64.length > 0),
    { message: "Fournir soit `text` (≥20 chars), soit `pdf_base64`." },
  );

/**
 * POST /api/claude/analyze-document
 * Analyse un document médical avec Claude Opus 4.7.
 * Le contexte patient (cancer, stade, traitements) est interpolé dans le prompt.
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
  const { family_id, text, pdf_base64 } = parsed.data;

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

  // Charger le profil cancer pour contextualiser
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("*")
    .eq("family_id", family_id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Profil cancer introuvable" },
      { status: 404 },
    );
  }

  // Charger la knowledge base partagée du type de cancer (si disponible)
  const { data: kb } = await supabase
    .from("cancer_knowledge_base")
    .select(
      "cancer_type_label, version, generated_at, status, expert_network, staging_classification, biomarkers, standard_protocols, surveillance_recommendations, red_flags, genetic_considerations",
    )
    .eq("cancer_type", profile.cancer_type)
    .maybeSingle();

  const { buildKnowledgeContextBlock } = await import("@/lib/knowledge-context");

  const ctx = buildPromptContext(profile);
  const system = interpolate(DOCUMENT_ANALYSIS_PROMPT, ctx) + buildKnowledgeContextBlock(kb);

  // Construction du message utilisateur : texte fourni OU instruction d'analyse du PDF joint
  const userMessage = text && text.trim().length >= 20
    ? text
    : "Analyse le document PDF ci-joint selon les consignes du système. Réponds uniquement en JSON.";

  const t0 = Date.now();
  try {
    const result = await callClaudeJson<DocumentAnalysisResult>({
      model: "claude-opus-4-7",
      system,
      user: userMessage,
      pdf_base64: pdf_base64 || undefined,
      max_tokens: 4096,
    });
    await logApiUsage({
      endpoint: "claude/analyze-document",
      model: "claude-opus-4-7",
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
      endpoint: "claude/analyze-document",
      model: "claude-opus-4-7",
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
