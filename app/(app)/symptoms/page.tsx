import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SymptomsTrackingClient from "@/components/symptoms/SymptomsTrackingClient";
import type { SymptomLog } from "@/lib/symptoms";

export const dynamic = "force-dynamic";

export default async function SymptomsPage() {
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

  // 90j max pour limiter le payload — la page autorise le filtre 7/14/30/90
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("symptom_logs")
    .select("*")
    .eq("family_id", membership.family_id)
    .gte("logged_at", since)
    .order("logged_at", { ascending: false });

  return (
    <SymptomsTrackingClient
      familyId={membership.family_id}
      symptoms={(data ?? []) as unknown as SymptomLog[]}
    />
  );
}
