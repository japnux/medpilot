import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WatchClient from "@/components/watch/WatchClient";
import type { WatchFindingResult } from "@/lib/watch-prompts";

export const dynamic = "force-dynamic";

/**
 * Module 5 — Veille proactive.
 * Charge la dernière veille générée (non archivée) et passe au client.
 */
export default async function WatchPage() {
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

  const { data: latest } = await supabase
    .from("watch_findings")
    .select("*")
    .eq("family_id", membership.family_id)
    .eq("is_archived", false)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sérialiser le finding en typage WatchFindingResult
  const finding = latest
    ? ({
        id: latest.id,
        generated_at: latest.generated_at,
        executive_summary: latest.executive_summary ?? "",
        top_priorities: latest.top_priorities as WatchFindingResult["top_priorities"],
        clinical_trials: latest.clinical_trials as WatchFindingResult["clinical_trials"],
        publications: latest.publications as WatchFindingResult["publications"],
        expert_centers: latest.expert_centers as WatchFindingResult["expert_centers"],
        patient_resources: latest.patient_resources as WatchFindingResult["patient_resources"],
        contextual_alerts: latest.contextual_alerts as WatchFindingResult["contextual_alerts"],
      } as WatchFindingResult & { id: string; generated_at: string })
    : null;

  return <WatchClient familyId={membership.family_id} finding={finding} />;
}
