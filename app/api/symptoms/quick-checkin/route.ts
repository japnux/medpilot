import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { detectRedFlagMatches, type RedFlag } from "@/lib/symptom-criticality";
import type { Database } from "@/types/database";

type SymptomInsert = Database["public"]["Tables"]["symptom_logs"]["Insert"];

export const runtime = "nodejs";

const ItemSchema = z.object({
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
  linked_medication_id: z.string().uuid().nullable().optional(),
});

const Schema = z.object({
  family_id: z.string().uuid(),
  logged_at: z.string().optional(),
  wellbeing_score: z.number().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(ItemSchema).default([]),
});

/**
 * POST /api/symptoms/quick-checkin — insère un check-in quotidien complet :
 *  - une row "wellbeing" si wellbeing_score fourni
 *  - une row par item (symptôme ou signe vital)
 * Puis lance la détection de red flags sur les 48h récentes et marque
 * éventuellement les rows critiques.
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

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("family_id", data.family_id)
    .maybeSingle();
  if (!membership)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  if (
    !data.wellbeing_score &&
    data.items.length === 0 &&
    !data.notes
  ) {
    return NextResponse.json(
      { error: "Check-in vide" },
      { status: 400 },
    );
  }

  const loggedAt = data.logged_at ?? new Date().toISOString();
  const rows: SymptomInsert[] = [];

  // Row "wellbeing" en premier (porte la note + le score global)
  if (data.wellbeing_score || data.notes) {
    rows.push({
      family_id: data.family_id,
      logged_by: user.id,
      logged_at: loggedAt,
      category: "wellbeing",
      symptom_type: "wellbeing",
      symptom_label: "Bien-être global",
      wellbeing_score: data.wellbeing_score ?? null,
      notes: data.notes ?? null,
    });
  }

  for (const it of data.items) {
    rows.push({
      family_id: data.family_id,
      logged_by: user.id,
      logged_at: loggedAt,
      category: it.category,
      symptom_type: it.symptom_type,
      symptom_label: it.symptom_label,
      severity: it.severity ?? null,
      numeric_value: it.numeric_value ?? null,
      numeric_value_2: it.numeric_value_2 ?? null,
      numeric_unit: it.numeric_unit ?? null,
      linked_medication_id: it.linked_medication_id ?? null,
    });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("symptom_logs")
    .insert(rows)
    .select("*");
  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Détection red flags
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

  let redFlag: ReturnType<typeof detectRedFlagMatches> = null;
  if (profile?.cancer_type) {
    const { data: kb } = await supabase
      .from("cancer_knowledge_base")
      .select("red_flags")
      .eq("cancer_type", profile.cancer_type)
      .maybeSingle();
    const flags = (kb?.red_flags as unknown as RedFlag[]) ?? [];
    redFlag = detectRedFlagMatches(
      (recent ?? []).map((r) => ({
        symptom_type: r.symptom_type,
        symptom_label: r.symptom_label,
        notes: r.notes,
        category: null,
      })),
      flags,
    );
    if (redFlag) {
      const ids = (inserted ?? []).map((r) => r.id);
      await supabase
        .from("symptom_logs")
        .update({
          is_critical: true,
          red_flag_matched: redFlag.redFlag.symptom_or_sign ?? "Red flag",
          matched_keywords: redFlag.matchedKeywords,
        })
        .in("id", ids);
    }
  }

  return NextResponse.json({
    ok: true,
    inserted_count: inserted?.length ?? 0,
    red_flag: redFlag
      ? {
          title: redFlag.redFlag.symptom_or_sign,
          severity: redFlag.redFlag.severity,
          rationale: redFlag.redFlag.rationale,
          action: redFlag.redFlag.action,
          matched_keywords: redFlag.matchedKeywords,
        }
      : null,
  });
}
