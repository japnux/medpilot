import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DuringConsultClient from "@/components/consultation/DuringConsultClient";
import type { ConsultationPrepResult } from "@/lib/prompts";

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

  return (
    <DuringConsultClient
      consultation={{
        ...consultation,
        prepared_questions:
          (consultation.prepared_questions as unknown as ConsultationPrepResult) ??
          null,
        decisions_made:
          (consultation.decisions_made as unknown as string[]) ?? null,
        followup_actions:
          (consultation.followup_actions as unknown as string[]) ?? null,
      }}
    />
  );
}
