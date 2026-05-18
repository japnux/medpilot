import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/admin";
import { callClaudeJson, parseJsonResponse } from "@/lib/anthropic";
import { logApiUsage } from "@/lib/usage-tracker";
import {
  buildPromptContext,
  DOCUMENT_ANALYSIS_PROMPT,
  interpolate,
  type DocumentAnalysisResult,
} from "@/lib/prompts";
import { buildKnowledgeSystemPrompt } from "@/lib/knowledge-prompts";
import { buildWatchSystemPrompt } from "@/lib/watch-prompts";
import { buildWatchContext } from "@/lib/watch-context";
import { buildToneInstructions } from "@/lib/tone";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/regen
 *
 * Régénère UNE ressource Claude (KB, document, ou veille) en bypass des
 * rate limits utilisateurs. Réservé aux admins ADMIN_EMAILS. Le client UI
 * appelle cet endpoint en boucle pour regen tout l'existant après une
 * évolution de prompt (ex: ajout du mode Apaisé).
 *
 * Body :
 *   { kind: "knowledge", cancer_type: string }
 *   { kind: "document",  id: string }
 *   { kind: "watch",     family_id: string }
 */
const Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("knowledge"), cancer_type: z.string().min(1) }),
  z.object({ kind: z.literal("document"), id: z.string().uuid() }),
  z.object({ kind: z.literal("watch"), family_id: z.string().uuid() }),
]);

export async function POST(request: NextRequest) {
  const { user, isAdmin } = await getAdminContext();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquant" }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey });
  const svc = createServiceClient();

  try {
    switch (parsed.data.kind) {
      case "knowledge":
        return await regenKnowledge(parsed.data.cancer_type, svc, anthropic, user.id);
      case "document":
        return await regenDocument(parsed.data.id, svc, user.id);
      case "watch":
        return await regenWatch(parsed.data.family_id, svc, anthropic, user.id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ============================================================================
// Knowledge base regen
// ============================================================================

async function regenKnowledge(
  cancerType: string,
  svc: ReturnType<typeof createServiceClient>,
  anthropic: Anthropic,
  userId: string,
) {
  // Charger la fiche existante pour récupérer label / country
  const { data: existing } = await svc
    .from("cancer_knowledge_base")
    .select("id, cancer_type, cancer_type_label, country")
    .eq("cancer_type", cancerType)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "KB introuvable" }, { status: 404 });
  }

  // Marqueur generating
  await svc
    .from("cancer_knowledge_base")
    .update({ status: "generating" })
    .eq("id", existing.id);

  const systemPrompt = buildKnowledgeSystemPrompt({
    cancerType: existing.cancer_type,
    cancerTypeLabel: existing.cancer_type_label,
    country: existing.country ?? "France",
    language: "fr",
    todayDate: new Date().toLocaleDateString("fr-FR"),
  });

  const t0 = Date.now();
  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 12000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Régénère la fiche de référence complète pour ${existing.cancer_type_label} (${existing.cancer_type}). Effectue les recherches web nécessaires sur les sociétés savantes, ESMO, PubMed, ClinicalTrials.gov, et retourne UNIQUEMENT le JSON structuré, sans préambule, sans markdown.`,
        },
      ],
      tools: [
        { type: "web_search_20250305" as never, name: "web_search" } as never,
      ],
    });
    await logApiUsage({
      endpoint: "admin/regen:knowledge",
      model: "claude-opus-4-7",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      user_id: userId,
      duration_ms: Date.now() - t0,
    });
  } catch (err) {
    await svc
      .from("cancer_knowledge_base")
      .update({ status: "failed" })
      .eq("id", existing.id);
    throw err;
  }

  const fullText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  let parsedJson: Record<string, unknown>;
  try {
    parsedJson = parseJsonResponse<Record<string, unknown>>(fullText);
  } catch {
    // Haiku fallback comme dans generate-knowledge
    const haiku = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 12000,
      system:
        "Tu reçois un texte exploratoire d'une fiche médicale. Tu dois en extraire un JSON STRICTEMENT VALIDE avec les sections : overview, expert_network, staging_classification, biomarkers, standard_protocols, clinical_trials_landscape, surveillance_recommendations, side_effects_to_monitor, red_flags, genetic_considerations, patient_resources, key_questions_for_team, recent_updates, sources. Retourne UNIQUEMENT le JSON.",
      messages: [{ role: "user", content: fullText }],
    });
    await logApiUsage({
      endpoint: "admin/regen:knowledge:haiku-fallback",
      model: "claude-haiku-4-5-20251001",
      input_tokens: haiku.usage.input_tokens,
      output_tokens: haiku.usage.output_tokens,
      user_id: userId,
    });
    const fallback = haiku.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    parsedJson = parseJsonResponse<Record<string, unknown>>(fallback);
  }

  const safe = JSON.parse(JSON.stringify(parsedJson));
  const { error: updErr } = await svc
    .from("cancer_knowledge_base")
    .update({
      overview: safe.overview ?? {},
      expert_network: safe.expert_network ?? [],
      staging_classification: safe.staging_classification ?? {},
      biomarkers: safe.biomarkers ?? [],
      standard_protocols: safe.standard_protocols ?? [],
      clinical_trials_landscape: safe.clinical_trials_landscape ?? [],
      surveillance_recommendations: safe.surveillance_recommendations ?? {},
      side_effects_to_monitor: safe.side_effects_to_monitor ?? [],
      red_flags: safe.red_flags ?? [],
      genetic_considerations: safe.genetic_considerations ?? {},
      patient_resources: safe.patient_resources ?? [],
      key_questions_for_team: safe.key_questions_for_team ?? [],
      recent_updates: safe.recent_updates ?? [],
      sources: safe.sources ?? [],
      token_usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      status: "ready",
      generated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (updErr) throw updErr;

  return NextResponse.json({
    ok: true,
    kind: "knowledge",
    cancer_type: cancerType,
    duration_ms: Date.now() - t0,
  });
}

// ============================================================================
// Document reanalyze
// ============================================================================

async function regenDocument(
  docId: string,
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const { data: doc } = await svc
    .from("medical_documents")
    .select("id, family_id, storage_path, title, document_type")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  if (!doc.storage_path) {
    return NextResponse.json(
      { error: "Pas de PDF stocké pour ce document" },
      { status: 400 },
    );
  }

  const { data: profile } = await svc
    .from("cancer_profiles")
    .select("*")
    .eq("family_id", doc.family_id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const { data: kb } = await svc
    .from("cancer_knowledge_base")
    .select(
      "cancer_type_label, version, generated_at, status, expert_network, staging_classification, biomarkers, standard_protocols, surveillance_recommendations, red_flags, genetic_considerations",
    )
    .eq("cancer_type", profile.cancer_type)
    .maybeSingle();

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

  const { buildKnowledgeContextBlock } = await import("@/lib/knowledge-context");
  const { enrichWithMedications } = await import("@/lib/medications-context");
  const medicationsBlock = await enrichWithMedications(
    svc as unknown as Parameters<typeof enrichWithMedications>[0],
    doc.family_id,
  );

  const ctx = buildPromptContext(profile);
  // Mode "balanced" par défaut pour la regen admin (compromis acceptable
  // pour tous les utilisateurs de la famille — chacun applique ses propres
  // adoucissements client-side ensuite).
  const system =
    interpolate(DOCUMENT_ANALYSIS_PROMPT, ctx) +
    buildKnowledgeContextBlock(kb) +
    medicationsBlock +
    buildToneInstructions("balanced");

  const t0 = Date.now();
  let result;
  try {
    result = await callClaudeJson<DocumentAnalysisResult>({
      model: "claude-opus-4-7",
      system,
      user: "Re-analyse le document PDF ci-joint avec le prompt courant. Réponds uniquement en JSON.",
      pdf_base64,
      max_tokens: 4096,
    });
    await logApiUsage({
      endpoint: "admin/regen:document",
      model: "claude-opus-4-7",
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      family_id: doc.family_id,
      user_id: userId,
      duration_ms: Date.now() - t0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logApiUsage({
      endpoint: "admin/regen:document",
      model: "claude-opus-4-7",
      input_tokens: 0,
      output_tokens: 0,
      family_id: doc.family_id,
      user_id: userId,
      success: false,
      error_message: msg,
      duration_ms: Date.now() - t0,
    });
    throw err;
  }

  const safe = JSON.parse(JSON.stringify(result.json));
  const { error: upErr } = await svc
    .from("medical_documents")
    .update({ analysis_summary: safe })
    .eq("id", docId);
  if (upErr) throw upErr;

  return NextResponse.json({
    ok: true,
    kind: "document",
    document_id: docId,
    duration_ms: Date.now() - t0,
  });
}

// ============================================================================
// Watch regen (sans rate limit)
// ============================================================================

async function regenWatch(
  familyId: string,
  svc: ReturnType<typeof createServiceClient>,
  anthropic: Anthropic,
  userId: string,
) {
  const { data: profile } = await svc
    .from("cancer_profiles")
    .select("*")
    .eq("family_id", familyId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const { data: kb } = await svc
    .from("cancer_knowledge_base")
    .select(
      "cancer_type_label, version, generated_at, status, expert_network, staging_classification, biomarkers, standard_protocols, surveillance_recommendations, red_flags, genetic_considerations",
    )
    .eq("cancer_type", profile.cancer_type)
    .maybeSingle();

  const ctx = buildWatchContext(profile);
  if (kb && kb.status === "ready" && Array.isArray(kb.expert_network) && kb.expert_network.length > 0) {
    ctx.expertNetwork = JSON.stringify(kb.expert_network);
  }
  const { buildKnowledgeContextBlock } = await import("@/lib/knowledge-context");
  const { enrichWithMedications } = await import("@/lib/medications-context");
  const medicationsBlock = await enrichWithMedications(
    svc as unknown as Parameters<typeof enrichWithMedications>[0],
    familyId,
  );
  const systemPrompt =
    buildWatchSystemPrompt(ctx) +
    buildKnowledgeContextBlock(kb) +
    medicationsBlock +
    buildToneInstructions("balanced");

  const t0 = Date.now();
  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16384,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Génère la veille proactive complète pour ${ctx.patientFirstName} à la date du ${ctx.todayDate}. Recherches web nécessaires (clinicaltrials.gov, PubMed, sociétés savantes) puis retourne UNIQUEMENT le JSON structuré.`,
        },
      ],
      tools: [
        { type: "web_search_20250305" as never, name: "web_search" } as never,
      ],
    });
    await logApiUsage({
      endpoint: "admin/regen:watch",
      model: "claude-opus-4-7",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      family_id: familyId,
      user_id: userId,
      duration_ms: Date.now() - t0,
    });
  } catch (err) {
    throw err;
  }

  const fullText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  let parsedJson;
  try {
    parsedJson = parseJsonResponse<Record<string, unknown>>(fullText);
  } catch {
    const structuring = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 12000,
      system:
        "Tu reçois un texte exploratoire d'une veille médicale. Extrais un JSON STRICTEMENT VALIDE avec : { executive_summary, top_priorities, clinical_trials, publications, expert_centers, patient_resources, contextual_alerts }. Retourne UNIQUEMENT le JSON.",
      messages: [{ role: "user", content: fullText }],
    });
    await logApiUsage({
      endpoint: "admin/regen:watch:haiku-fallback",
      model: "claude-haiku-4-5-20251001",
      input_tokens: structuring.usage.input_tokens,
      output_tokens: structuring.usage.output_tokens,
      family_id: familyId,
      user_id: userId,
    });
    const fallback = structuring.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    parsedJson = parseJsonResponse<Record<string, unknown>>(fallback);
  }

  const safe = JSON.parse(JSON.stringify(parsedJson));
  const { data: finding, error: insErr } = await svc
    .from("watch_findings")
    .insert({
      family_id: familyId,
      generated_by: userId,
      patient_context: JSON.parse(JSON.stringify(ctx)),
      executive_summary: safe.executive_summary ?? null,
      top_priorities: safe.top_priorities ?? [],
      clinical_trials: safe.clinical_trials ?? [],
      publications: safe.publications ?? [],
      expert_centers: safe.expert_centers ?? [],
      patient_resources: safe.patient_resources ?? [],
      contextual_alerts: safe.contextual_alerts ?? [],
      model_used: "claude-opus-4-7",
      token_usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  return NextResponse.json({
    ok: true,
    kind: "watch",
    family_id: familyId,
    finding_id: finding.id,
    duration_ms: Date.now() - t0,
  });
}
