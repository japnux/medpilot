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

  const [{ data: events }, { data: surveillance }] = await Promise.all([
    // Tous les événements de la timeline, du plus récent au plus ancien
    supabase
      .from("timeline_events")
      .select(
        "id, event_type, event_date, title, summary, is_critical, linked_document_id, linked_consultation_id",
      )
      .eq("family_id", membership.family_id)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    // Surveillance : seulement les 5 prochaines échéances non faites
    supabase
      .from("surveillance_alerts")
      .select("id, alert_type, label, due_date, is_done")
      .eq("family_id", membership.family_id)
      .eq("is_done", false)
      .gte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5),
  ]);

  return (
    <TimelineClient
      familyId={membership.family_id}
      events={events ?? []}
      surveillance={surveillance ?? []}
    />
  );
}
