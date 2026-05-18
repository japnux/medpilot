import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/admin";

export const runtime = "nodejs";

const Schema = z.object({
  user_id: z.string().uuid(),
  tone_preference: z.enum(["medical", "balanced", "soft"]),
});

/**
 * PATCH /api/admin/user-tone
 *
 * Définit la tonalité d'affichage d'un utilisateur. Réservé aux admins
 * (ADMIN_EMAILS) : la tonalité est un choix éditorial qui doit pouvoir
 * être différencié par membre de famille (ex: Geoffrey en "medical",
 * Sarah en "soft").
 *
 * Body : { user_id, tone_preference }
 */
export async function PATCH(request: NextRequest) {
  const { user, isAdmin } = await getAdminContext();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Mise à jour sur toutes les family_members de cet user (un user peut
  // appartenir à plusieurs familles, sa préférence est globale).
  const svc = createServiceClient();
  const { error } = await svc
    .from("family_members")
    .update({ tone_preference: parsed.data.tone_preference })
    .eq("user_id", parsed.data.user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user_id: parsed.data.user_id,
    tone_preference: parsed.data.tone_preference,
  });
}
