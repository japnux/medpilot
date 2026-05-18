import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DuringConsultClient from "@/components/consultation/DuringConsultClient";
import DecisionsSection from "@/components/decisions/DecisionsSection";
import type { ConsultationPrepResult } from "@/lib/prompts";
import type { DecisionRow } from "@/lib/decisions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConsultationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consultation } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!consultation) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: decisions },
    { data: upcomingConsults },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("decisions")
      .select("*")
      .eq("source_consultation_id", id)
      .order("status", { ascending: true })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("consultations")
      .select("id, consultation_date, consultation_type, doctor_name")
      .eq("family_id", consultation.family_id)
      .eq("status", "upcoming")
      .gte("consultation_date", today)
      .order("consultation_date", { ascending: true })
      .limit(10),
    supabase
      .from("cancer_profiles")
      .select("care_team")
      .eq("family_id", consultation.family_id)
      .maybeSingle(),
  ]);

  const careTeamNames = Array.isArray(profile?.care_team)
    ? (profile.care_team as Array<{ name?: string }>)
        .map((m) => m.name)
        .filter((n): n is string => Boolean(n))
    : [];

  return (
    <div className="space-y-6">
      <DuringConsultClient
        consultation={{
          ...consultation,
          prepared_questions:
            (consultation.prepared_questions as unknown as ConsultationPrepResult) ??
            null,
        }}
        decisionCounts={
          decisions
            ? {
                total: decisions.length,
                pending: decisions.filter((d) => d.status === "pending").length,
              }
            : undefined
        }
        careTeamNames={careTeamNames}
      />
      {decisions && decisions.length > 0 && (
        <div id="decisions-section" className="p-6 max-w-3xl mx-auto">
          <DecisionsSection
            decisions={decisions as unknown as DecisionRow[]}
            sourceLabel="par cette consultation"
            upcomingConsultations={(upcomingConsults ?? []).map((c) => ({
              id: c.id,
              consultation_date: c.consultation_date,
              consultation_type: c.consultation_type,
              doctor_name: c.doctor_name,
            }))}
          />
        </div>
      )}
    </div>
  );
}
