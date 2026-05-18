import { createServiceClient } from "@/lib/supabase/service";
import RegenClient from "./RegenClient";

export const dynamic = "force-dynamic";

/**
 * /admin/regen — Panneau de régénération complète.
 *
 * Liste toutes les ressources Claude existantes (KB, documents avec PDF,
 * veilles uniques par famille) et permet de les re-passer à Claude une
 * par une, avec progression visuelle et retry par ligne.
 */
export default async function AdminRegenPage() {
  const svc = createServiceClient();

  const [{ data: kbs }, { data: docs }, { data: watches }] = await Promise.all([
    svc
      .from("cancer_knowledge_base")
      .select("id, cancer_type, cancer_type_label, status, generated_at")
      .order("generated_at", { ascending: false }),
    svc
      .from("medical_documents")
      .select(
        "id, family_id, title, document_type, document_date, storage_path, created_at, analysis_updated_at",
      )
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false }),
    // Pour les veilles : on garde le finding le plus récent par famille
    // (regen = nouvelle ligne, jamais d'update sur place).
    svc
      .from("watch_findings")
      .select("id, family_id, generated_at")
      .order("generated_at", { ascending: false }),
  ]);

  return (
    <RegenClient
      knowledgeBases={kbs ?? []}
      documents={docs ?? []}
      watchFindings={watches ?? []}
    />
  );
}
