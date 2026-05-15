import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AnalyzerClient from "@/components/analyzer/AnalyzerClient";

export const dynamic = "force-dynamic";

/**
 * Module 1 — Analyse de documents médicaux par Claude Opus 4.7.
 */
export default async function AnalyzerPage() {
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

  const { data: history } = await supabase
    .from("medical_documents")
    .select("id, title, document_date, document_type, created_at, doctor_name")
    .eq("family_id", membership.family_id)
    .order("created_at", { ascending: false })
    .limit(30);

  return <AnalyzerClient familyId={membership.family_id} history={history ?? []} />;
}
