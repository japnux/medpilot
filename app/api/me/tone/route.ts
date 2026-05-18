import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Schema = z.object({
  tone_preference: z.enum(["medical", "balanced", "soft"]),
});

/**
 * PATCH /api/me/tone
 * Met à jour la tonalité d'affichage préférée de l'utilisateur courant.
 * Stocké par user_id (un proche peut être en "medical" pendant que le
 * patient lui-même est en "soft").
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tonalité invalide", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Mise à jour sur toutes les family_members de cet user (un user peut
  // appartenir à plusieurs familles, sa préférence est globale).
  const { error } = await supabase
    .from("family_members")
    .update({ tone_preference: parsed.data.tone_preference })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tone_preference: parsed.data.tone_preference });
}
