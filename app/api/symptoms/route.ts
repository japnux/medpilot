import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { detectRedFlagMatches, type RedFlag } from "@/lib/symptom-criticality";

export const runtime = "nodejs";

const Schema = z.object({
  family_id: z.string().uuid(),
  category: z.enum([
    "digestive",
    "neurological",
    "cardiovascular",
    "general",
    "psychological",
    "skin",
    "musculoskeletal",
    "respiratory",
    "vital_sign",
    "wellbeing",
    "other",
  ]),
  symptom_type: z.string().min(1),
  symptom_label: z.string().min(1),
  severity: z.number().min(0).max(10).nullable().optional(),
  numeric_value: z.number().nullable().optional(),
  numeric_value_2: z.number().nullable().optional(),
  numeric_unit: z.string().nullable().optional(),
  wellbeing_score: z.number().min(1).max(5).nullable().optional(),
  duration_minutes: z.number().int().min(0).nullable().optional(),
  context: z.array(z.string()).optional(),
  linked_medication_id: z.string().uuid().nullable().optional(),
  logged_at: z.string().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * POST /api/symptoms — crée un symptôme + détecte les red flags via la KB
 * cancer. Si match, marque le symptôme comme critical (is_critical=true,
 * red_flag_matched=titre).
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
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // RLS gère l'autorisation famille, mais on vérifie quand même côté serveur
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("family_id", data.family_id)
    .maybeSingle();
  if (!membership)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  // Insert d'abord, puis on fait la détection sur les 48h récentes
  const { data: created, error: insErr } = await supabase
    .from("symptom_logs")
    .insert({
      family_id: data.family_id,
      logged_by: user.id,
      logged_at: data.logged_at ?? new Date().toISOString(),
      category: data.category,
      symptom_type: data.symptom_type,
      symptom_label: data.symptom_label,
      severity: data.severity ?? null,
      numeric_value: data.numeric_value ?? null,
      numeric_value_2: data.numeric_value_2 ?? null,
      numeric_unit: data.numeric_unit ?? null,
      wellbeing_score: data.wellbeing_score ?? null,
      duration_minutes: data.duration_minutes ?? null,
      context: data.context ?? [],
      linked_medication_id: data.linked_medication_id ?? null,
      notes: data.notes ?? null,
    })
    .select("*")
    .single();
  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Détection red flags (48h)
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const [{ data: recent }, { data: profile }] = await Promise.all([
    supabase
      .from("symptom_logs")
      .select("symptom_type, symptom_label, notes, category")
      .eq("family_id", data.family_id)
      .gte("logged_at", since)
      .limit(50),
    supabase
      .from("cancer_profiles")
      .select("cancer_type")
      .eq("family_id", data.family_id)
      .maybeSingle(),
  ]);

  let redFlagMatched: { match: ReturnType<typeof detectRedFlagMatches>; symptomId: string } | null =
    null;
  if (profile?.cancer_type) {
    const { data: kb } = await supabase
      .from("cancer_knowledge_base")
      .select("red_flags")
      .eq("cancer_type", profile.cancer_type)
      .maybeSingle();
    const flags = (kb?.red_flags as unknown as RedFlag[]) ?? [];
    const match = detectRedFlagMatches(
      (recent ?? []).map((r) => ({
        symptom_type: r.symptom_type,
        symptom_label: r.symptom_label,
        notes: r.notes,
        category: null,
      })),
      flags,
    );
    if (match) {
      redFlagMatched = { match, symptomId: created.id };
      await supabase
        .from("symptom_logs")
        .update({
          is_critical: true,
          red_flag_matched: match.redFlag.symptom_or_sign ?? "Red flag",
          matched_keywords: match.matchedKeywords,
        })
        .eq("id", created.id);
    }
  }

  return NextResponse.json({
    ok: true,
    symptom: created,
    red_flag: redFlagMatched
      ? {
          title: redFlagMatched.match?.redFlag.symptom_or_sign,
          severity: redFlagMatched.match?.redFlag.severity,
          rationale: redFlagMatched.match?.redFlag.rationale,
          action: redFlagMatched.match?.redFlag.action,
          matched_keywords: redFlagMatched.match?.matchedKeywords,
        }
      : null,
  });
}
