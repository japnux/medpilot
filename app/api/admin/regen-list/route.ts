import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * GET /api/admin/regen-list
 *
 * Liste toutes les ressources Claude regénérables (KB, documents, veilles).
 * Utilisé par le panneau /admin/regen pour piloter une regen complète.
 *
 * Coût estimé (Opus 4.7 ~$0.05 / Opus + web_search ~$0.75) calculé côté UI.
 */
export async function GET() {
  const { user, isAdmin } = await getAdminContext();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const svc = createServiceClient();

  const [{ data: kbs }, { data: docs }, { data: watches }] = await Promise.all([
    svc
      .from("cancer_knowledge_base")
      .select("id, cancer_type, cancer_type_label, status, generated_at")
      .order("generated_at", { ascending: false }),
    svc
      .from("medical_documents")
      .select("id, family_id, title, document_type, document_date, storage_path, created_at")
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false }),
    svc
      .from("watch_findings")
      .select("id, family_id, generated_at")
      .order("generated_at", { ascending: false }),
  ]);

  return NextResponse.json({
    ok: true,
    knowledge_bases: kbs ?? [],
    documents: docs ?? [],
    watch_findings: watches ?? [],
  });
}
