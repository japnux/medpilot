import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

const NullableUrl = z
  .string()
  .trim()
  .max(1000)
  .url()
  .nullable()
  .or(z.literal("").transform(() => null));

const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    brand_name: z.string().trim().max(200).nullable(),
    active_ingredient: z.string().trim().max(200).nullable(),
    dosage: z.string().trim().max(100).nullable(),
    form: z.string().trim().max(100).nullable(),
    posology: z.string().trim().min(1).max(2000),
    route: RouteEnum,
    indication: z.string().trim().max(500).nullable(),
    prescriber: z.string().trim().max(200).nullable(),
    started_at: z.string().date().nullable(),
    ended_at: z.string().date().nullable(),
    status: StatusEnum,
    status_reason: z.string().trim().max(500).nullable(),
    notes: z.string().trim().max(2000).nullable(),
    wikipedia_url: NullableUrl,
    vidal_url: NullableUrl,
    ansm_url: NullableUrl,
    known_side_effects: z.string().trim().max(3000).nullable(),
  })
  .partial();

/**
 * PATCH /api/medications/[id]
 * Met à jour un médicament. RLS garantit que seul un membre de la famille
 * propriétaire peut éditer. Si on passe à `stopped` sans ended_at, on le force
 * à aujourd'hui (cohérence métier).
 */
export async function PATCH(
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
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch = { ...parsed.data };
  if (patch.status === "stopped" && patch.ended_at == null) {
    patch.ended_at = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from("medications")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Médicament introuvable ou accès refusé" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, medication: data });
}

/**
 * DELETE /api/medications/[id]
 * Suppression hard. La confirmation est côté UI.
 */
export async function DELETE(
  _request: NextRequest,
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

  const { error, count } = await supabase
    .from("medications")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json(
      { error: "Médicament introuvable ou accès refusé" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
