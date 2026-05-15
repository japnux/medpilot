import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logApiUsage } from "@/lib/usage-tracker";
import type { MarkerDef } from "@/lib/cancer-profiles";

export const runtime = "nodejs";
export const maxDuration = 30;

const Schema = z.object({
  marker_name: z.string().min(1),
  marker_label: z.string().min(1),
  /** Force la régénération même si une description est déjà en cache. */
  force: z.boolean().optional(),
});

/**
 * POST /api/markers/describe
 * Génère (si manquante) une description courte d'un marqueur biologique
 * pour la famille du user. La description est stockée dans
 * cancer_profiles.custom_markers[marker_name].description.
 *
 * Appelé lazy depuis la page détail marqueur si description manquante.
 * Économique : 1 appel Haiku par marker, en cache après.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const { marker_name, marker_label, force } = parsed.data;

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Pas de famille" }, { status: 403 });

  // Profil + custom_markers actuel + contexte cancer pour contextualiser la description
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("id, custom_markers, cancer_label, patient_first_name")
    .eq("family_id", membership.family_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const customMarkers =
    (profile.custom_markers as unknown as Record<string, MarkerDef>) ?? {};
  const existing = customMarkers[marker_name];

  // Déjà décrit ? retour direct (sauf si force=true)
  if (!force && existing?.description && existing.description.trim().length > 10) {
    await logApiUsage({
      endpoint: "markers/describe",
      model: "claude-haiku-4-5-20251001",
      input_tokens: 0,
      output_tokens: 0,
      cached: true,
      family_id: membership.family_id,
      user_id: user.id,
    });
    return NextResponse.json({ description: existing.description, cached: true });
  }

  // Génération via Haiku
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Clé Anthropic manquante" }, { status: 500 });
  const anthropic = new Anthropic({ apiKey });

  const t0 = Date.now();
  const cancerLabel = profile.cancer_label ?? "cancer";
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 250,
    system: `Tu es un assistant médical en oncologie. Tu décris brièvement un marqueur biologique pour un proche non-médecin qui accompagne un patient atteint de ${cancerLabel}.

Règles :
- Mentionne d'abord à quoi sert ce marqueur DANS CE CONTEXTE ONCOLOGIQUE (surveillance tumorale, effet d'un traitement, fonction d'un organe…).
- Si le marqueur a d'autres usages dominants en médecine générale (ex: β-HCG = grossesse), ne les évoque PAS sauf si pertinent ici.
- Ne suppose pas le sexe du patient sauf si le contexte le rend évident (ex: PSA = homme, marqueurs ovariens = femme).
- Réponds en 1 à 2 phrases (max 300 caractères), ton neutre et factuel, en français.
- Pas de préambule ni de markdown.`,
    messages: [
      {
        role: "user",
        content: `Décris le marqueur biologique "${marker_label}" pour un accompagnant de patient atteint de ${cancerLabel}.`,
      },
    ],
  });
  await logApiUsage({
    endpoint: "markers/describe",
    model: "claude-haiku-4-5-20251001",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    family_id: membership.family_id,
    user_id: user.id,
    duration_ms: Date.now() - t0,
  });

  const description = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim()
    .replace(/^["']|["']$/g, ""); // strip quotes éventuelles

  if (!description) {
    return NextResponse.json({ error: "Génération vide" }, { status: 502 });
  }

  // Update custom_markers via service_role (RLS update peut bloquer si non admin)
  const service = createServiceClient();
  const merged: Record<string, MarkerDef> = {
    ...customMarkers,
    [marker_name]: {
      ...(existing ?? {
        label: marker_label,
        unit: "",
        color: "#6366f1",
      }),
      description,
    },
  };
  await service
    .from("cancer_profiles")
    .update({ custom_markers: JSON.parse(JSON.stringify(merged)) })
    .eq("id", profile.id);

  return NextResponse.json({ description, cached: false });
}
