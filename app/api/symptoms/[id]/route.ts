import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchSchema = z.object({
  severity: z.number().min(0).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  is_resolved: z.boolean().optional(),
  is_critical: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const patch: {
    severity?: number | null;
    notes?: string | null;
    is_resolved?: boolean;
    is_critical?: boolean;
    resolved_at?: string | null;
  } = { ...parsed.data };
  if (parsed.data.is_resolved === true) {
    patch.resolved_at = new Date().toISOString();
  } else if (parsed.data.is_resolved === false) {
    patch.resolved_at = null;
  }

  const { error } = await supabase
    .from("symptom_logs")
    .update(patch)
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { error } = await supabase.from("symptom_logs").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
