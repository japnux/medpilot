import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TimelineClient, {
  type DecisionCountMap,
} from "@/components/timeline/TimelineClient";

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

  const [{ data: events }, { data: decisions }] = await Promise.all([
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
      .select("status, source_document_id, source_consultation_id")
      .eq("family_id", membership.family_id),
  ]);

  // Agrège les compteurs de décisions par source (document ou consultation)
  const decisionCounts: DecisionCountMap = {
    documents: {},
    consultations: {},
  };
  for (const d of decisions ?? []) {
    const isPending = d.status === "pending";
    if (d.source_document_id) {
      const k = d.source_document_id;
      decisionCounts.documents[k] = decisionCounts.documents[k] ?? {
        total: 0,
        pending: 0,
      };
      decisionCounts.documents[k].total += 1;
      if (isPending) decisionCounts.documents[k].pending += 1;
    }
    if (d.source_consultation_id) {
      const k = d.source_consultation_id;
      decisionCounts.consultations[k] = decisionCounts.consultations[k] ?? {
        total: 0,
        pending: 0,
      };
      decisionCounts.consultations[k].total += 1;
      if (isPending) decisionCounts.consultations[k].pending += 1;
    }
  }

  return (
    <TimelineClient
      familyId={membership.family_id}
      events={events ?? []}
      decisionCounts={decisionCounts}
    />
  );
}
