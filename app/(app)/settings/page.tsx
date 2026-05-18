import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/shared/SettingsClient";

export const dynamic = "force-dynamic";

interface CareTeamMember {
  name?: string;
  specialty?: string;
  hospital?: string;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role, tone_preference")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const isAdmin = membership.role === "admin";

  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase
      .from("cancer_profiles")
      .select("*")
      .eq("family_id", membership.family_id)
      .maybeSingle(),
    supabase
      .from("family_members")
      .select("id, user_id, role, display_name, relation")
      .eq("family_id", membership.family_id),
  ]);

  return (
    <SettingsClient
      familyId={membership.family_id}
      isAdmin={isAdmin}
      profile={profile}
      members={members ?? []}
      currentUserId={user.id}
      careTeam={(profile?.care_team as unknown as CareTeamMember[]) ?? []}
      currentTone={membership.tone_preference ?? "balanced"}
    />
  );
}
