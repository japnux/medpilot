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

  const [{ data: events }, { data: surveillance }] = await Promise.all([
    supabase
      .from("timeline_events")
      .select("id, event_type, event_date, title, summary, is_critical")
      .eq("family_id", membership.family_id)
      .order("event_date", { ascending: false })
      .limit(300),
    supabase
      .from("surveillance_alerts")
      .select("id, alert_type, label, due_date, is_done")
      .eq("family_id", membership.family_id)
      .order("due_date", { ascending: true })
      .limit(50),
  ]);

  return (
    <TimelineClient
      familyId={membership.family_id}
      events={events ?? []}
      surveillance={surveillance ?? []}
    />
  );
}
