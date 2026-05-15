import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DecisionsListClient from "@/components/decisions/DecisionsListClient";
import type { DecisionRow } from "@/lib/decisions";

export const dynamic = "force-dynamic";

interface SourceMap {
  documents: Record<string, { title: string; document_date: string | null }>;
  consultations: Record<
    string,
    { consultation_type: string; consultation_date: string }
  >;
}

/**
 * Liste centrale des décisions de la famille : à trancher en haut, puis
 * décidées et abandonnées en bas. Filtrable par statut + catégorie.
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

  const { data: decisions } = await supabase
    .from("decisions")
    .select("*")
    .eq("family_id", membership.family_id)
    .order("status", { ascending: true })
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = (decisions ?? []) as unknown as DecisionRow[];

  // Construit les libellés des sources (docs + consultations) en une requête
  const docIds = Array.from(
    new Set(rows.map((r) => r.source_document_id).filter(Boolean) as string[]),
  );
  const consultIds = Array.from(
    new Set(
      rows.map((r) => r.source_consultation_id).filter(Boolean) as string[],
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

  return <DecisionsListClient decisions={rows} sources={sources} />;
}
