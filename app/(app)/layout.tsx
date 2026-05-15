import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/shared/Sidebar";
import Header from "@/components/shared/Header";

/**
 * Layout authentifié partagé par les 4 modules + settings.
 * Charge le profil cancer côté serveur et injecte le contexte dans le header.
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

  // Charge la famille active de l'utilisateur + profil cancer
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("*")
    .eq("family_id", membership.family_id)
    .maybeSingle();

  // Dernière maj : on prend le max entre profil updated_at et le dernier événement
  const { data: lastEvent } = await supabase
    .from("timeline_events")
    .select("created_at")
    .eq("family_id", membership.family_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastUpdate =
    lastEvent?.created_at ?? profile?.updated_at ?? profile?.created_at ?? null;

  const activeTreatments: string[] = Array.isArray(profile?.active_treatments)
    ? (profile?.active_treatments as Array<{ name?: string }>).map(
        (t) => t?.name ?? "",
      ).filter(Boolean)
    : [];

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header
          patientName={profile?.patient_first_name ?? null}
          cancerLabel={profile?.cancer_label ?? "Cancer"}
          stage={profile?.stage ?? null}
          activeTreatments={activeTreatments}
          lastUpdate={lastUpdate}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
