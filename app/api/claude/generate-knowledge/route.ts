import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildKnowledgeSystemPrompt } from "@/lib/knowledge-prompts";
import { parseJsonResponse } from "@/lib/anthropic";
import { logApiUsage } from "@/lib/usage-tracker";

export const runtime = "nodejs";
export const maxDuration = 300;

const Schema = z.object({
  cancer_type: z.string().min(1),
  cancer_type_label: z.string().min(1),
  country: z.string().optional(),
  force: z.boolean().optional(),
});

/**
 * POST /api/claude/generate-knowledge
 *
 * Génère (ou recharge) la fiche de référence d'un type de cancer.
 * - Idempotent : si status='ready' déjà, on retourne sans rappeler Claude
 * - Fire-and-forget côté client : pas besoin d'attendre, status passe à
 *   'generating' puis 'ready' (ou 'failed')
 * - Écriture via service_role pour contourner les RLS (la table est en
 *   lecture publique uniquement)
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
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const { cancer_type, cancer_type_label, country, force } = parsed.data;

  const service = createServiceClient();

  // Idempotence : si ready et pas de force, retourner directement
  const { data: existing } = await service
    .from("cancer_knowledge_base")
    .select("id, status, generated_at")
    .eq("cancer_type", cancer_type)
    .maybeSingle();

  if (existing && existing.status === "ready" && !force) {
    return NextResponse.json({
      knowledge_base_id: existing.id,
      status: "already_exists",
      generated_at: existing.generated_at,
    });
  }

  // Placeholder 'generating' (upsert pour gérer le cas premier passage)
  const { data: placeholder, error: upErr } = await service
    .from("cancer_knowledge_base")
    .upsert(
      {
        cancer_type,
        cancer_type_label,
        country: country ?? "France",
        status: "generating",
        generated_by: user.id,
      },
      { onConflict: "cancer_type" },
    )
    .select("id")
    .single();
  if (upErr || !placeholder) {
    return NextResponse.json(
      { error: upErr?.message ?? "Insert placeholder échoué" },
      { status: 500 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquant" }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = buildKnowledgeSystemPrompt({
    cancerType: cancer_type,
    cancerTypeLabel: cancer_type_label,
    country: country ?? "France",
    language: "fr",
    todayDate: new Date().toLocaleDateString("fr-FR"),
  });

  const t0 = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 12000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Génère la fiche de référence complète pour ${cancer_type_label} (${cancer_type}). Effectue les recherches web nécessaires sur les sociétés savantes, ESMO, PubMed, ClinicalTrials.gov, et retourne UNIQUEMENT le JSON structuré, sans préambule, sans markdown.`,
        },
      ],
      tools: [
        {
          type: "web_search_20250305" as never,
          name: "web_search",
        } as never,
      ],
    });
    await logApiUsage({
      endpoint: "claude/generate-knowledge",
      model: "claude-opus-4-7",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      user_id: user.id,
      duration_ms: Date.now() - t0,
    });

    console.log(
      "[generate-knowledge] cancer_type=",
      cancer_type,
      "stop=",
      response.stop_reason,
      "usage=",
      JSON.stringify(response.usage),
    );

    const fullText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let parsedJson: Record<string, unknown>;
    try {
      parsedJson = parseJsonResponse<Record<string, unknown>>(fullText);
    } catch {
      // Fallback : Haiku structure le texte exploratoire en JSON valide
      console.warn("[generate-knowledge] direct parse failed, Haiku fallback");
      const haiku = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 12000,
        system:
          "Tu reçois un texte exploratoire d'une fiche médicale. Tu dois en extraire un JSON STRICTEMENT VALIDE avec les sections : overview, expert_network, staging_classification, biomarkers, standard_protocols, clinical_trials_landscape, surveillance_recommendations, side_effects_to_monitor, red_flags, genetic_considerations, patient_resources, key_questions_for_team, recent_updates, sources. Retourne UNIQUEMENT le JSON, rien d'autre. Si une section n'a pas de contenu, retourne {} ou [] selon le type. Ne pas inventer.",
        messages: [{ role: "user", content: fullText }],
      });
      await logApiUsage({
        endpoint: "claude/generate-knowledge:haiku-fallback",
        model: "claude-haiku-4-5-20251001",
        input_tokens: haiku.usage.input_tokens,
        output_tokens: haiku.usage.output_tokens,
        user_id: user.id,
      });
      const fallback = haiku.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      parsedJson = parseJsonResponse<Record<string, unknown>>(fallback);
    }

    const safe = JSON.parse(JSON.stringify(parsedJson));

    const { error: updateErr } = await service
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
      .eq("id", placeholder.id);

    if (updateErr) {
      await service
        .from("cancer_knowledge_base")
        .update({ status: "failed" })
        .eq("id", placeholder.id);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Lier le cancer_profile concerné de l'utilisateur courant (best-effort)
    await service
      .from("cancer_profiles")
      .update({ knowledge_base_id: placeholder.id })
      .eq("cancer_type", cancer_type);

    return NextResponse.json({
      knowledge_base_id: placeholder.id,
      status: "ready",
    });
  } catch (err) {
    await service
      .from("cancer_knowledge_base")
      .update({ status: "failed" })
      .eq("id", placeholder.id);
    const msg = err instanceof Error ? err.message : "Erreur génération";
    await logApiUsage({
      endpoint: "claude/generate-knowledge",
      model: "claude-opus-4-7",
      input_tokens: 0,
      output_tokens: 0,
      user_id: user.id,
      success: false,
      error_message: msg,
      duration_ms: Date.now() - t0,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
