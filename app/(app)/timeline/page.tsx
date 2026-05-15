import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TimelineClient from "@/components/timeline/TimelineClient";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
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

  const [
    { data: upcomingConsults },
    { data: pastConsults },
    { data: documents },
    { data: surveillance },
  ] = await Promise.all([
    // Prochains RDV : consultations status=upcoming OU date >= today
    supabase
      .from("consultations")
      .select("id, consultation_date, doctor_name, consultation_type, hospital, status")
      .eq("family_id", membership.family_id)
      .neq("status", "cancelled")
      .gte("consultation_date", today)
      .order("consultation_date", { ascending: true })
      .limit(50),
    // Passés : status=completed OU date < today
    supabase
      .from("consultations")
      .select("id, consultation_date, doctor_name, consultation_type, hospital, status, decisions_made")
      .eq("family_id", membership.family_id)
      .lt("consultation_date", today)
      .neq("status", "cancelled")
      .order("consultation_date", { ascending: false })
      .limit(100),
    // Documents : tous, triés par date du document desc
    supabase
      .from("medical_documents")
      .select("id, title, document_type, document_date, created_at, analysis_summary")
      .eq("family_id", membership.family_id)
      .order("document_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
    // Surveillance non faite (compte dans Prochains RDV)
    supabase
      .from("surveillance_alerts")
      .select("id, alert_type, label, due_date, is_done")
      .eq("family_id", membership.family_id)
      .eq("is_done", false)
      .order("due_date", { ascending: true })
      .limit(50),
  ]);

  return (
    <TimelineClient
      familyId={membership.family_id}
      upcomingConsults={upcomingConsults ?? []}
      pastConsults={pastConsults ?? []}
      documents={documents ?? []}
      surveillance={surveillance ?? []}
    />
  );
}
