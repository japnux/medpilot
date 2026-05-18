import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TimelineClient, {
  type DecisionCountMap,
  type CrossModuleCountMap,
} from "@/components/timeline/TimelineClient";

export const dynamic = "force-dynamic";

/**
 * Fenêtre temporelle pour le clustering des symptômes autour d'un event.
 * J-3 à J+3 (7 jours centrés) : permet de voir l'état du patient autour
 * d'une consultation ou d'un bilan biologique.
 */
const SYMPTOM_WINDOW_DAYS = 3;

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

  const familyId = membership.family_id;

  const [
    { data: events },
    { data: decisions },
    { data: medications },
    { data: symptoms },
  ] = await Promise.all([
    supabase
      .from("timeline_events")
      .select(
        "id, event_type, event_date, title, summary, is_critical, linked_document_id, linked_consultation_id",
      )
      .eq("family_id", familyId)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("decisions")
      .select("status, source_document_id, source_consultation_id"),
    // Médicaments avec leur date de début : pour matcher au jour d'une consult
    supabase
      .from("medications")
      .select("id, started_at")
      .eq("family_id", familyId)
      .not("started_at", "is", null),
    // Symptômes des 6 derniers mois (pour clustering ±3j autour d'un event)
    supabase
      .from("symptom_logs")
      .select("logged_at, category")
      .eq("family_id", familyId)
      .gte(
        "logged_at",
        new Date(Date.now() - 180 * 86_400_000).toISOString(),
      ),
  ]);

  // Décisions agrégées par source (document ou consultation)
  const decisionCounts: DecisionCountMap = {
    documents: {},
    consultations: {},
  };
  for (const d of decisions ?? []) {
    const isPending = d.status === "pending";
    const isDecided = d.status === "decided";
    if (d.source_document_id) {
      const k = d.source_document_id;
      decisionCounts.documents[k] = decisionCounts.documents[k] ?? {
        total: 0,
        pending: 0,
        decided: 0,
      };
      decisionCounts.documents[k].total += 1;
      if (isPending) decisionCounts.documents[k].pending += 1;
      if (isDecided) decisionCounts.documents[k].decided += 1;
    }
    if (d.source_consultation_id) {
      const k = d.source_consultation_id;
      decisionCounts.consultations[k] = decisionCounts.consultations[k] ?? {
        total: 0,
        pending: 0,
        decided: 0,
      };
      decisionCounts.consultations[k].total += 1;
      if (isPending) decisionCounts.consultations[k].pending += 1;
      if (isDecided) decisionCounts.consultations[k].decided += 1;
    }
  }

  // Médicaments par date de début (YYYY-MM-DD). Si plusieurs médocs
  // démarrés le même jour, on les compte tous (ex: une ordo qui prescrit
  // 4 médocs en même temps).
  const medsByStartDate: Record<string, number> = {};
  for (const m of medications ?? []) {
    if (!m.started_at) continue;
    medsByStartDate[m.started_at] = (medsByStartDate[m.started_at] ?? 0) + 1;
  }

  // Symptômes par date (sans bin) — on agrégera ±3j côté composant
  // pour rester simple. Ici on stocke juste {date: count}.
  const symptomsByDate: Record<string, number> = {};
  for (const s of symptoms ?? []) {
    if (!s.logged_at) continue;
    // category=wellbeing = score quotidien, on ne compte pas comme symptôme
    if (s.category === "wellbeing") continue;
    const day = s.logged_at.slice(0, 10);
    symptomsByDate[day] = (symptomsByDate[day] ?? 0) + 1;
  }

  // Pour chaque event date, calcule combien de symptômes dans ±3 jours
  const eventDates = new Set((events ?? []).map((e) => e.event_date));
  const crossCounts: CrossModuleCountMap = {};
  for (const eventDate of eventDates) {
    const medsCount = medsByStartDate[eventDate] ?? 0;
    let symptomsCount = 0;
    const center = new Date(eventDate).getTime();
    for (let d = -SYMPTOM_WINDOW_DAYS; d <= SYMPTOM_WINDOW_DAYS; d++) {
      const dayIso = new Date(center + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      symptomsCount += symptomsByDate[dayIso] ?? 0;
    }
    crossCounts[eventDate] = {
      medications: medsCount,
      symptoms: symptomsCount,
    };
  }

  return (
    <TimelineClient
      familyId={familyId}
      events={events ?? []}
      decisionCounts={decisionCounts}
      crossCounts={crossCounts}
    />
  );
}
