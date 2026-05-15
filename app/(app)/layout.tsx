import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/shared/Sidebar";
import { isAdminEmail } from "@/lib/admin";

/**
 * Layout authentifié partagé par tous les modules.
 * Sidebar à gauche (collapsible). Pas de header global : chaque page gère
 * son propre header avec le contexte utile.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("cancer_type, patient_first_name")
    .eq("family_id", membership.family_id)
    .maybeSingle();

  const { count: pendingDecisionsCount } = await supabase
    .from("decisions")
    .select("id", { count: "exact", head: true })
    .eq("family_id", membership.family_id)
    .eq("status", "pending");

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        cancerType={profile?.cancer_type ?? null}
        patientName={profile?.patient_first_name ?? null}
        isAdmin={isAdminEmail(user.email)}
        pendingDecisionsCount={pendingDecisionsCount ?? 0}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
