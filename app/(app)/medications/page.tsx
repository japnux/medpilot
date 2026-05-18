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

  // Auto-transition silencieuse : un médoc actif dont la date de fin est
  // dépassée passe à 'stopped'. Couvre :
  //  - les médocs avec ended_at fixé directement (extraction depuis ordo)
  //  - les médocs avec un schedule dont la dernière étape est terminée
  // Best-effort : si l'UPDATE échoue (RLS, conflit), on log et on continue.
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("medications")
    .update({
      status: "stopped",
      status_reason: "Fin du plan posologique",
    })
    .eq("family_id", familyId)
    .eq("status", "active")
    .not("ended_at", "is", null)
    .lt("ended_at", today);

  // Cas schedule : on identifie les médocs actifs dont la max(end_date) du
  // schedule est passée, sans ended_at fixé.
  const { data: scheduleEnds } = await supabase
    .from("medication_schedule_steps")
    .select("medication_id, end_date, medications!inner(family_id, status, ended_at)")
    .eq("medications.family_id", familyId)
    .eq("medications.status", "active")
    .is("medications.ended_at", null)
    .not("end_date", "is", null);

  if (scheduleEnds && scheduleEnds.length > 0) {
    const lastStepByMed = new Map<string, string>();
    for (const s of scheduleEnds) {
      const prev = lastStepByMed.get(s.medication_id);
      if (!prev || s.end_date > prev) {
        lastStepByMed.set(s.medication_id, s.end_date);
      }
    }
    const expired = [...lastStepByMed.entries()]
      .filter(([, end]) => end < today)
      .map(([id, end]) => ({ id, end }));
    if (expired.length > 0) {
      for (const { id, end } of expired) {
        await supabase
          .from("medications")
          .update({
            status: "stopped",
            status_reason: "Fin du plan posologique",
            ended_at: end,
          })
          .eq("id", id);
      }
    }
  }

  const [
    { data: profile },
    { data: medications },
    { data: dosageChanges },
    { data: scheduleSteps },
  ] = await Promise.all([
    supabase
      .from("cancer_profiles")
      .select("patient_first_name, care_team")
      .eq("family_id", familyId)
      .maybeSingle(),
    supabase
      .from("medications")
      .select("*")
      .eq("family_id", familyId)
      .order("status", { ascending: true })
      .order("started_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("medication_dosage_changes")
      .select("*")
      .eq("family_id", familyId)
      .order("changed_at", { ascending: false }),
    // Schedule steps de toute la famille (RLS via medication parent).
    // On joint sur medications pour filtrer côté DB plutôt qu'un IN coûteux.
    supabase
      .from("medication_schedule_steps")
      .select("*, medications!inner(family_id)")
      .eq("medications.family_id", familyId)
      .order("medication_id", { ascending: true })
      .order("step_order", { ascending: true }),
  ]);

  // Map dosageChanges par medication_id pour le passer aux cartes.
  type DosageChange = NonNullable<typeof dosageChanges>[number];
  const dosageChangesByMed: Record<string, DosageChange[]> = {};
  for (const c of dosageChanges ?? []) {
    const list = dosageChangesByMed[c.medication_id] ?? [];
    list.push(c);
    dosageChangesByMed[c.medication_id] = list;
  }

  // Map des paliers de plan posologique par medication_id.
  // On vire la propriété de jointure `medications` pour avoir des ScheduleStep nus.
  type ScheduleStepRaw = NonNullable<typeof scheduleSteps>[number];
  const scheduleByMed: Record<string, ScheduleStepRaw[]> = {};
  for (const s of scheduleSteps ?? []) {
    const list = scheduleByMed[s.medication_id] ?? [];
    list.push(s);
    scheduleByMed[s.medication_id] = list;
  }

  // care_team est en JSONB libre : on garde uniquement les entrées avec un nom.
  const careTeam = Array.isArray(profile?.care_team)
    ? (profile.care_team as Array<{
        name?: string;
        specialty?: string;
        hospital?: string;
      }>).filter((m) => typeof m?.name === "string" && m.name.trim().length > 0)
    : [];

  return (
    <MedicationsClient
      familyId={familyId}
      initialMedications={medications ?? []}
      patientFirstName={profile?.patient_first_name ?? null}
      careTeam={careTeam}
      dosageChangesByMed={dosageChangesByMed}
      scheduleByMed={scheduleByMed}
    />
  );
}
