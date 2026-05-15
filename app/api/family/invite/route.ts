import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const InviteSchema = z.object({
  family_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["patient", "accompagnant"]),
  display_name: z.string().min(1),
  relation: z.string().optional(),
});

/**
 * POST /api/family/invite
 * Invite un utilisateur par email à rejoindre une famille.
 * Vérifie que le caller est admin de cette famille.
 */
export async function POST(request: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Validation
  const body = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { family_id, email, role, display_name, relation } = parsed.data;

  // 3. Vérifier que l'utilisateur est admin de cette famille
  const { data: membership } = await supabase
    .from("family_members")
    .select("role")
    .eq("family_id", family_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // 4. Inviter l'utilisateur via la clé service_role
  const service = createServiceClient();
  const { data: invited, error: inviteErr } =
    await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    });

  if (inviteErr || !invited?.user) {
    return NextResponse.json(
      { error: inviteErr?.message ?? "Échec de l'invitation" },
      { status: 500 },
    );
  }

  // 5. Pré-enregistrer le family_member pour l'invité
  const { error: memErr } = await service.from("family_members").insert({
    family_id,
    user_id: invited.user.id,
    role,
    display_name,
    relation: relation ?? null,
  });

  if (memErr) {
    return NextResponse.json(
      { error: `Invitation envoyée mais lien famille échoué : ${memErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, user_id: invited.user.id });
}
