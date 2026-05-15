import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConsultationClient from "@/components/consultation/ConsultationClient";

export const dynamic = "force-dynamic";

export default async function ConsultationPage() {
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await supabase
    .from("consultations")
    .select("id, consultation_date, doctor_name, consultation_type, hospital, status")
    .eq("family_id", membership.family_id)
    .eq("status", "upcoming")
    .gte("consultation_date", today)
    .order("consultation_date", { ascending: true })
    .limit(20);

  return (
    <ConsultationClient
      familyId={membership.family_id}
      upcoming={upcoming ?? []}
    />
  );
}
