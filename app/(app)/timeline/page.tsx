import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TimelineClient from "@/components/timeline/TimelineClient";
import type { DecisionRow } from "@/lib/decisions";

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

  const [{ data: events }, { data: pendingDecisions }] = await Promise.all([
    supabase
      .from("timeline_events")
      .select(
        "id, event_type, event_date, title, summary, is_critical, linked_document_id, linked_consultation_id",
      )
      .eq("family_id", membership.family_id)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("decisions")
      .select("*")
      .eq("family_id", membership.family_id)
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
  ]);

  return (
    <TimelineClient
      familyId={membership.family_id}
      events={events ?? []}
      pendingDecisions={(pendingDecisions ?? []) as unknown as DecisionRow[]}
    />
  );
}
