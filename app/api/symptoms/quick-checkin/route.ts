import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  detectRedFlagForNewSymptom,
  type RedFlag,
} from "@/lib/symptom-criticality";
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
 * POST /api/symptoms/quick-checkin — batch insert :
 *  - 1 row "wellbeing" si wellbeing_score ou notes
 *  - N rows par item (symptôme ou signe vital)
 *
 * Détection red flag : appliquée individuellement à chaque row insérée
 * (sauf wellbeing). Seules les rows qui contribuent réellement à un red
 * flag sont marquées critiques, en utilisant les autres rows + les 48h
 * récentes comme contexte.
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

  if (!data.wellbeing_score && data.items.length === 0 && !data.notes) {
    return NextResponse.json({ error: "Check-in vide" }, { status: 400 });
  }

  const loggedAt = data.logged_at ?? new Date().toISOString();
  const rows: SymptomInsert[] = [];

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

  // Détection red flags : 48h récentes EXCLUANT les rows fraîchement insérées
  const insertedIds = (inserted ?? []).map((r) => r.id);
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const [{ data: recentRaw }, { data: profile }] = await Promise.all([
    supabase
      .from("symptom_logs")
      .select("id, symptom_type, symptom_label, category")
      .eq("family_id", data.family_id)
      .gte("logged_at", since)
      .limit(80),
    supabase
      .from("cancer_profiles")
      .select("cancer_type")
      .eq("family_id", data.family_id)
      .maybeSingle(),
  ]);

  const recent = (recentRaw ?? []).filter((r) => !insertedIds.includes(r.id));

  let returnedFlag: {
    title?: string;
    severity?: string;
    rationale?: string;
    action?: string;
    matched_signs?: string[];
  } | null = null;

  if (profile?.cancer_type && inserted) {
    const { data: kb } = await supabase
      .from("cancer_knowledge_base")
      .select("red_flags")
      .eq("cancer_type", profile.cancer_type)
      .maybeSingle();
    const flags = (kb?.red_flags as unknown as RedFlag[]) ?? [];

    // Pour chaque row insérée (hors wellbeing), tente une détection en utilisant
    // les autres rows insérées + les 48h récentes comme contexte.
    const otherInserted = inserted.filter((r) => r.category !== "wellbeing");
    for (const row of inserted) {
      if (row.category === "wellbeing") continue;
      const contextRows = [
        ...otherInserted.filter((r) => r.id !== row.id),
        ...recent,
      ];
      const match = detectRedFlagForNewSymptom(
        {
          symptom_type: row.symptom_type,
          symptom_label: row.symptom_label,
          category: row.category as Parameters<typeof detectRedFlagForNewSymptom>[0]["category"],
        },
        contextRows.map((r) => ({
          symptom_type: r.symptom_type,
          symptom_label: r.symptom_label,
          category: r.category as Parameters<typeof detectRedFlagForNewSymptom>[0]["category"],
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
          .eq("id", row.id);
        if (!returnedFlag) {
          returnedFlag = {
            title: match.redFlag.symptom_or_sign,
            severity: match.redFlag.severity,
            rationale: match.redFlag.rationale,
            action: match.redFlag.action,
            matched_signs: match.matchedSigns,
          };
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    inserted_count: inserted?.length ?? 0,
    red_flag: returnedFlag,
  });
}
