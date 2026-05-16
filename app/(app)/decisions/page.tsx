import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DecisionsListClient from "@/components/decisions/DecisionsListClient";
import type { DecisionRow } from "@/lib/decisions";
import { detectObsolescenceSignals } from "@/lib/decisions-obsolescence";

export const dynamic = "force-dynamic";

interface SourceMap {
  documents: Record<string, { title: string; document_date: string | null }>;
  consultations: Record<
    string,
    { consultation_type: string; consultation_date: string }
  >;
}

/**
 * Cockpit décisions. Côté serveur on :
 *  1. fetch toutes les décisions
 *  2. fetch consultations + profile (pour détection obsolescence)
 *  3. injecte les signaux d'obsolescence calculés sur chaque décision pending
 *  4. fetch consultations upcoming (pour le chemin "Attente équipe" du modal)
 *  5. fetch les sources (docs + consults) pour libellés cliquables
 */
export default async function DecisionsPage() {
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
    { data: decisionsRaw },
    { data: allConsults },
    { data: upcomingConsults },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("decisions")
      .select("*")
      .eq("family_id", membership.family_id)
      .order("status", { ascending: true })
      .order("priority", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("consultations")
      .select("id, status, consultation_date")
      .eq("family_id", membership.family_id),
    supabase
      .from("consultations")
      .select("id, consultation_date, consultation_type, doctor_name")
      .eq("family_id", membership.family_id)
      .eq("status", "upcoming")
      .gte("consultation_date", today)
      .order("consultation_date", { ascending: true })
      .limit(15),
    supabase
      .from("cancer_profiles")
      .select("surgery_date")
      .eq("family_id", membership.family_id)
      .maybeSingle(),
  ]);

  const decisions = ((decisionsRaw ?? []) as unknown as DecisionRow[]).map(
    (d) => {
      // On enrichit chaque pending avec les signaux d'obsolescence calculés
      // (les autres statuts ont déjà leur état figé).
      if (d.status !== "pending") return d;
      const signals = detectObsolescenceSignals(
        d,
        (allConsults ?? []).map((c) => ({
          status: c.status,
          consultation_date: c.consultation_date,
        })),
        profile ?? null,
      );
      return { ...d, obsolescence_signals: signals };
    },
  );

  // Construit les libellés des sources
  const docIds = Array.from(
    new Set(
      decisions.map((r) => r.source_document_id).filter(Boolean) as string[],
    ),
  );
  const consultIds = Array.from(
    new Set(
      decisions
        .map((r) => r.source_consultation_id)
        .filter(Boolean) as string[],
    ),
  );

  const sources: SourceMap = { documents: {}, consultations: {} };

  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from("medical_documents")
      .select("id, title, document_date")
      .in("id", docIds);
    for (const d of docs ?? []) {
      sources.documents[d.id] = {
        title: d.title,
        document_date: d.document_date,
      };
    }
  }
  if (consultIds.length > 0) {
    const { data: consults } = await supabase
      .from("consultations")
      .select("id, consultation_type, consultation_date")
      .in("id", consultIds);
    for (const c of consults ?? []) {
      sources.consultations[c.id] = {
        consultation_type: c.consultation_type ?? "consultation",
        consultation_date: c.consultation_date,
      };
    }
  }

  return (
    <DecisionsListClient
      decisions={decisions}
      sources={sources}
      upcomingConsultations={(upcomingConsults ?? []).map((c) => ({
        id: c.id,
        consultation_date: c.consultation_date,
        consultation_type: c.consultation_type,
        doctor_name: c.doctor_name,
      }))}
    />
  );
}
