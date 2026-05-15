import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildWatchSystemPrompt } from "@/lib/watch-prompts";
import { buildWatchContext } from "@/lib/watch-context";
import { parseJsonResponse } from "@/lib/anthropic";

// La web_search est lente (1-3 min). Limite Vercel : 300s côté Pro.
export const runtime = "nodejs";
export const maxDuration = 300;

const Schema = z.object({
  family_id: z.string().uuid(),
});

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/claude/watch-refresh
 *
 * Génère une nouvelle veille proactive pour la famille. Rate limit : 1 refresh
 * par semaine maximum (par famille), pour maîtriser le coût (Opus + web_search
 * ≈ 0.50-1€/refresh).
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
  const { family_id } = parsed.data;

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

  // Rate limit : 1 refresh par semaine
  const { data: latest } = await supabase
    .from("watch_findings")
    .select("id, generated_at")
    .eq("family_id", family_id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest) {
    const ageMs = Date.now() - new Date(latest.generated_at).getTime();
    if (ageMs < ONE_WEEK_MS) {
      const nextAt = new Date(
        new Date(latest.generated_at).getTime() + ONE_WEEK_MS,
      );
      const daysRemaining = Math.ceil((ONE_WEEK_MS - ageMs) / (24 * 60 * 60 * 1000));
      return NextResponse.json(
        {
          error: "rate_limited",
          message: `Une veille a été générée il y a moins de 7 jours. Prochain refresh disponible dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}.`,
          next_available_at: nextAt.toISOString(),
          last_generated_at: latest.generated_at,
        },
        { status: 429 },
      );
    }
  }

  // Charger le profil cancer
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("*")
    .eq("family_id", family_id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Profil cancer introuvable. Complétez l'onboarding." },
      { status: 400 },
    );
  }

  const ctx = buildWatchContext(profile);
  const systemPrompt = buildWatchSystemPrompt(ctx);

  // Appel Claude Opus + web_search
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquant" }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey });

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Génère la veille proactive complète pour ${ctx.patientFirstName} à la date du ${ctx.todayDate}. Effectue les recherches web nécessaires (clinicaltrials.gov, PubMed, sociétés savantes) et retourne le JSON structuré.`,
        },
      ],
      // web_search tool — recherche live des sources
      tools: [
        {
          type: "web_search_20250305" as never,
          name: "web_search",
        } as never,
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Claude API";
    return NextResponse.json({ error: `Claude API : ${msg}` }, { status: 502 });
  }

  // Concaténer le texte de tous les blocs `text` (peut contenir tool_use blocks)
  const fullText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!fullText) {
    return NextResponse.json(
      { error: "Réponse Claude vide", raw_blocks: response.content.length },
      { status: 502 },
    );
  }

  // Parser JSON robuste (strip fences + extract first {...} last })
  let parsedJson;
  try {
    parsedJson = parseJsonResponse<Record<string, unknown>>(fullText);
  } catch (e) {
    return NextResponse.json(
      {
        error: "JSON malformé dans la réponse Claude",
        preview: fullText.slice(0, 400),
      },
      { status: 502 },
    );
  }

  // Re-serialiser tout en JSON propre pour Supabase (les types Json strict
  // n'aiment pas les `unknown` cast). C'est sans coût significatif.
  const safe = JSON.parse(JSON.stringify(parsedJson));

  const { data: finding, error: insErr } = await supabase
    .from("watch_findings")
    .insert({
      family_id,
      generated_by: user.id,
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

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, finding_id: finding.id });
}
