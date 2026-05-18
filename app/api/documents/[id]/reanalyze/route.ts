import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { callClaudeJson } from "@/lib/anthropic";
import { logApiUsage } from "@/lib/usage-tracker";
import {
  buildPromptContext,
  DOCUMENT_ANALYSIS_PROMPT,
  interpolate,
  type DocumentAnalysisResult,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * POST /api/documents/[id]/reanalyze
 *
 * Re-passe le PDF d'un document existant à Claude pour rafraîchir
 * `analysis_summary`. Utile après une évolution du prompt (ajout du
 * champ `prescriptions[].schedule[]`, par exemple).
 *
 * Le PDF doit être présent dans le storage (`storage_path` non null).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 1. Charger le document (RLS protège : seul un membre de la famille passe)
  const { data: doc } = await supabase
    .from("medical_documents")
    .select("id, family_id, storage_path, title, document_type")
    .eq("id", id)
    .maybeSingle();
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
  if (!doc.storage_path) {
    return NextResponse.json(
      { error: "Pas de PDF stocké pour ce document" },
      { status: 400 },
    );
  }

  // 2. Profil cancer pour contextualiser le prompt
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("*")
    .eq("family_id", doc.family_id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  // 3. KB partagée (utilisée pour contextualiser l'analyse)
  const { data: kb } = await supabase
    .from("cancer_knowledge_base")
    .select(
      "cancer_type_label, version, generated_at, status, expert_network, staging_classification, biomarkers, standard_protocols, surveillance_recommendations, red_flags, genetic_considerations",
    )
    .eq("cancer_type", profile.cancer_type)
    .maybeSingle();

  // 4. Télécharger le PDF depuis le storage (service role pour bypass RLS storage)
  const svc = createServiceClient();
  const { data: blob, error: dlErr } = await svc.storage
    .from("medical-documents")
    .download(doc.storage_path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: `Téléchargement PDF échoué : ${dlErr?.message ?? "inconnu"}` },
      { status: 502 },
    );
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  const pdf_base64 = buffer.toString("base64");

  // 5. Construire le système + appeler Claude Opus
  const { buildKnowledgeContextBlock } = await import("@/lib/knowledge-context");
  const { enrichWithMedications } = await import("@/lib/medications-context");
  const medicationsBlock = await enrichWithMedications(supabase, doc.family_id);
  const ctx = buildPromptContext(profile);
  const system =
    interpolate(DOCUMENT_ANALYSIS_PROMPT, ctx) +
    buildKnowledgeContextBlock(kb) +
    medicationsBlock;

  const t0 = Date.now();
  let result;
  try {
    result = await callClaudeJson<DocumentAnalysisResult>({
      model: "claude-opus-4-7",
      system,
      user:
        "Re-analyse le document PDF ci-joint avec le prompt mis à jour. Réponds uniquement en JSON.",
      pdf_base64,
      max_tokens: 4096,
    });
    await logApiUsage({
      endpoint: "documents/reanalyze",
      model: "claude-opus-4-7",
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      family_id: doc.family_id,
      user_id: user.id,
      duration_ms: Date.now() - t0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Claude";
    await logApiUsage({
      endpoint: "documents/reanalyze",
      model: "claude-opus-4-7",
      input_tokens: 0,
      output_tokens: 0,
      family_id: doc.family_id,
      user_id: user.id,
      success: false,
      error_message: msg,
      duration_ms: Date.now() - t0,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 6. Update analysis_summary
  const safe = JSON.parse(JSON.stringify(result.json));
  const { error: upErr } = await supabase
    .from("medical_documents")
    .update({ analysis_summary: safe })
    .eq("id", id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    prescriptions_count: Array.isArray(safe.prescriptions)
      ? safe.prescriptions.length
      : 0,
  });
}
