import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Schema = z.object({
  new_dosage: z.string().trim().min(1).max(100),
  new_posology: z.string().trim().max(2000).nullable().optional(),
  changed_at: z.string().date().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
  prescriber: z.string().trim().max(200).nullable().optional(),
  source_consultation_id: z.string().uuid().nullable().optional(),
  source_document_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

/**
 * POST /api/medications/[id]/dosage-change
 *
 * Enregistre un changement de dose en 3 étapes :
 *  1. Lit la dose/posologie courante depuis `medications`
 *  2. INSERT dans `medication_dosage_changes` avec previous_* et new_*
 *  3. UPDATE `medications` pour refléter la dose courante
 *  4. (bonus) INSERT timeline_events type=treatment_adjustment
 *
 * Pas de transaction Postgres native via supabase-js : si l'étape 2 réussit
 * mais 3 échoue, l'historique reste cohérent (juste un changement sans mise
 * à jour de la dose courante — corrigeable manuellement).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // 1. Charger la row médicament actuelle (RLS gère l'accès famille)
  const { data: med, error: medErr } = await supabase
    .from("medications")
    .select("id, family_id, name, dosage, posology")
    .eq("id", id)
    .maybeSingle();
  if (medErr)
    return NextResponse.json({ error: medErr.message }, { status: 500 });
  if (!med)
    return NextResponse.json(
      { error: "Médicament introuvable ou accès refusé" },
      { status: 404 },
    );

  const changedAt = data.changed_at ?? new Date().toISOString().slice(0, 10);

  // 2. INSERT historique
  const { data: change, error: insErr } = await supabase
    .from("medication_dosage_changes")
    .insert({
      medication_id: med.id,
      family_id: med.family_id,
      changed_at: changedAt,
      previous_dosage: med.dosage,
      previous_posology: med.posology,
      new_dosage: data.new_dosage,
      new_posology: data.new_posology ?? null,
      reason: data.reason ?? null,
      prescriber: data.prescriber ?? null,
      source_consultation_id: data.source_consultation_id ?? null,
      source_document_id: data.source_document_id ?? null,
      notes: data.notes ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  // 3. UPDATE médicament pour refléter la dose courante
  const newPosology = data.new_posology ?? med.posology;
  const { error: upErr } = await supabase
    .from("medications")
    .update({
      dosage: data.new_dosage,
      posology: newPosology,
    })
    .eq("id", med.id);
  if (upErr) {
    // L'historique est en place mais la row courante non à jour : on signale
    return NextResponse.json(
      {
        ok: true,
        warning: `Historique enregistré mais mise à jour de la dose courante échouée : ${upErr.message}`,
        change,
      },
      { status: 207 },
    );
  }

  // (Pas d'insertion timeline_events ici : les ajustements de dose ne sont
  // plus surfacés sur la timeline pour limiter le bruit. L'historique reste
  // accessible depuis la section « Historique des doses » de chaque carte
  // médicament.)

  return NextResponse.json({ ok: true, change });
}
