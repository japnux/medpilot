import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/medications/[id]/schedule
 * Retourne les paliers du plan posologique du médicament.
 *
 * PUT /api/medications/[id]/schedule
 * Remplace le plan complet (delete all + insert) en transaction logique.
 * Le client envoie le nouveau tableau, on garantit la cohérence.
 */

const StepSchema = z.object({
  step_order: z.number().int().min(1),
  start_date: z.string().date(),
  end_date: z.string().date().nullable().optional(),
  dosage: z.string().trim().max(100).nullable().optional(),
  posology: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(500).nullable().optional(),
});

const PutSchema = z.object({
  steps: z.array(StepSchema),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // RLS sur medication_schedule_steps filtre via is_family_member
  const { data, error } = await supabase
    .from("medication_schedule_steps")
    .select("*")
    .eq("medication_id", id)
    .order("step_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, steps: data ?? [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérif accès au medication parent
  const { data: med } = await supabase
    .from("medications")
    .select("id, family_id")
    .eq("id", id)
    .maybeSingle();
  if (!med) {
    return NextResponse.json({ error: "Médicament introuvable" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Replace : on supprime tout puis on insère. RLS empêche tout cross-family.
  const { error: delErr } = await supabase
    .from("medication_schedule_steps")
    .delete()
    .eq("medication_id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (parsed.data.steps.length === 0) {
    return NextResponse.json({ ok: true, steps: [] });
  }

  const rows = parsed.data.steps.map((s) => ({
    medication_id: id,
    step_order: s.step_order,
    start_date: s.start_date,
    end_date: s.end_date ?? null,
    dosage: s.dosage ?? null,
    posology: s.posology,
    notes: s.notes ?? null,
  }));

  const { data, error: insErr } = await supabase
    .from("medication_schedule_steps")
    .insert(rows)
    .select("*")
    .order("step_order", { ascending: true });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, steps: data ?? [] });
}
