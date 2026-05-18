import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Schéma de saisie pour POST. `name` et `posology` obligatoires, tout le reste
 * optionnel. La validation s'aligne sur le CHECK SQL côté DB.
 */
const RouteEnum = z.enum([
  "oral",
  "im",
  "iv",
  "sc",
  "topical",
  "inhaled",
  "sublingual",
  "other",
]);
const StatusEnum = z.enum(["active", "stopped", "paused", "planned"]);

/** URL ou chaîne vide → null. Évite que le user soit forcé de remplir parfaitement. */
const NullableUrl = z
  .string()
  .trim()
  .max(1000)
  .url()
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

/** Palier de plan posologique optionnel à créer en même temps. */
const ScheduleStepSchema = z.object({
  step_order: z.number().int().min(1),
  start_date: z.string().date(),
  end_date: z.string().date().nullable().optional(),
  dosage: z.string().trim().max(100).nullable().optional(),
  posology: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(500).nullable().optional(),
});

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand_name: z.string().trim().max(200).optional().nullable(),
  active_ingredient: z.string().trim().max(200).optional().nullable(),
  dosage: z.string().trim().max(100).optional().nullable(),
  form: z.string().trim().max(100).optional().nullable(),
  posology: z.string().trim().min(1).max(2000),
  route: RouteEnum.optional(),
  indication: z.string().trim().max(500).optional().nullable(),
  prescriber: z.string().trim().max(200).optional().nullable(),
  started_at: z.string().date().optional().nullable(),
  ended_at: z.string().date().optional().nullable(),
  status: StatusEnum.optional(),
  status_reason: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  wikipedia_url: NullableUrl,
  vidal_url: NullableUrl,
  ansm_url: NullableUrl,
  known_side_effects: z.string().trim().max(3000).optional().nullable(),
  /**
   * Plan posologique structuré optionnel. Si fourni, on crée tous les paliers
   * en base après l'insert du médicament parent.
   */
  schedule: z.array(ScheduleStepSchema).optional(),
});

/**
 * GET /api/medications
 * Liste les médicaments de la famille du user courant.
 * family_id est dérivé du user (pas de paramètre URL → pas d'IDOR possible).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Aucune famille" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("medications")
    .select("*")
    .eq("family_id", membership.family_id)
    .order("status", { ascending: true })
    .order("started_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, medications: data ?? [] });
}

/**
 * POST /api/medications
 * Crée un médicament dans la famille du user. RLS bloque cross-family.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Aucune famille" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { schedule, ...medFields } = parsed.data;

  const { data, error } = await supabase
    .from("medications")
    .insert({
      ...medFields,
      family_id: membership.family_id,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insère les paliers du plan posologique si fourni.
  // Pas de transaction native, mais la cascade RLS via medication_id assure
  // l'isolation, et la suppression du médicament cascade les steps si rollback manuel.
  if (schedule && schedule.length > 0) {
    const rows = schedule.map((s) => ({
      medication_id: data.id,
      step_order: s.step_order,
      start_date: s.start_date,
      end_date: s.end_date ?? null,
      dosage: s.dosage ?? null,
      posology: s.posology,
      notes: s.notes ?? null,
    }));
    const { error: schedErr } = await supabase
      .from("medication_schedule_steps")
      .insert(rows);
    if (schedErr) {
      // Best-effort : on retourne le médicament créé même si le schedule
      // a échoué, avec un warning. L'utilisateur peut le réajouter manuellement.
      return NextResponse.json({
        ok: true,
        medication: data,
        schedule_error: schedErr.message,
      });
    }
  }

  return NextResponse.json({ ok: true, medication: data });
}
