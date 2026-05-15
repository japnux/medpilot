import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callClaudeJson } from "@/lib/anthropic";
import {
  buildPromptContext,
  DOCUMENT_ANALYSIS_PROMPT,
  interpolate,
  type DocumentAnalysisResult,
} from "@/lib/prompts";

const Schema = z.object({
  family_id: z.string().uuid(),
  text: z.string().min(20, "Le document est trop court"),
});

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
  const { family_id, text } = parsed.data;

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

  const ctx = buildPromptContext(profile);
  const system = interpolate(DOCUMENT_ANALYSIS_PROMPT, ctx);

  try {
    const result = await callClaudeJson<DocumentAnalysisResult>({
      model: "claude-opus-4-7",
      system,
      user: text,
      max_tokens: 4096,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Claude";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
