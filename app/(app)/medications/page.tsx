import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MedicationsClient from "@/components/medications/MedicationsClient";

export const dynamic = "force-dynamic";

/**
 * Module Medication — Lot 1.
 * Page principale : liste des médicaments de la famille du user.
 * Source de vérité pour les IA (M1, M3, M5) via injection dans les prompts.
 */
export default async function MedicationsPage() {
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

  const familyId = membership.family_id;

  const [{ data: profile }, { data: medications }] = await Promise.all([
    supabase
      .from("cancer_profiles")
      .select("patient_first_name")
      .eq("family_id", familyId)
      .maybeSingle(),
    supabase
      .from("medications")
      .select("*")
      .eq("family_id", familyId)
      .order("status", { ascending: true })
      .order("started_at", { ascending: false, nullsFirst: false }),
  ]);

  return (
    <MedicationsClient
      familyId={familyId}
      initialMedications={medications ?? []}
      patientFirstName={profile?.patient_first_name ?? null}
    />
  );
}
