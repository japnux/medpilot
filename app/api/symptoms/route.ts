import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  detectRedFlagForNewSymptom,
  type RedFlag,
} from "@/lib/symptom-criticality";

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

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("family_id", data.family_id)
    .maybeSingle();
  if (!membership)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

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

  // Détection red flags : on charge les 48h récentes EXCLUANT le nouveau
  // symptôme, puis on regarde si le nouveau contribue lui-même à un match.
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const [{ data: recent }, { data: profile }] = await Promise.all([
    supabase
      .from("symptom_logs")
      .select("symptom_type, symptom_label, category")
      .eq("family_id", data.family_id)
      .gte("logged_at", since)
      .neq("id", created.id)
      .limit(50),
    supabase
      .from("cancer_profiles")
      .select("cancer_type")
      .eq("family_id", data.family_id)
      .maybeSingle(),
  ]);

  let returnedFlag: {
    title?: string;
    severity?: string;
    rationale?: string;
    action?: string;
    matched_signs?: string[];
  } | null = null;

  if (profile?.cancer_type) {
    const { data: kb } = await supabase
      .from("cancer_knowledge_base")
      .select("red_flags")
      .eq("cancer_type", profile.cancer_type)
      .maybeSingle();
    const flags = (kb?.red_flags as unknown as RedFlag[]) ?? [];
    const match = detectRedFlagForNewSymptom(
      {
        symptom_type: created.symptom_type,
        symptom_label: created.symptom_label,
        category: created.category as SymptomCategoryLike,
      },
      (recent ?? []).map((r) => ({
        symptom_type: r.symptom_type,
        symptom_label: r.symptom_label,
        category: r.category as SymptomCategoryLike,
      })),
      flags,
    );
    if (match) {
      await supabase
        .from("symptom_logs")
        .update({
          is_critical: true,
          red_flag_matched: match.redFlag.symptom_or_sign ?? "Red flag",
          matched_keywords: match.matchedSigns,
        })
        .eq("id", created.id);
      returnedFlag = {
        title: match.redFlag.symptom_or_sign,
        severity: match.redFlag.severity,
        rationale: match.redFlag.rationale,
        action: match.redFlag.action,
        matched_signs: match.matchedSigns,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    symptom: created,
    red_flag: returnedFlag,
  });
}

// Aide pour caster le category de la DB (string | null) vers le type strict
type SymptomCategoryLike = Parameters<
  typeof detectRedFlagForNewSymptom
>[0]["category"];
