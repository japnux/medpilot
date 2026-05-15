import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AnalysisTabs from "@/components/analyzer/AnalysisTabs";
import type { DocumentAnalysisResult } from "@/lib/prompts";
import { formatDateFr } from "@/lib/dates";
import { ArrowLeft, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Page détail d'un document médical : ré-affiche l'analyse Claude (4 onglets)
 * directement depuis le JSONB stocké en base. Pas de nouvel appel Claude.
 */
export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: doc } = await supabase
    .from("medical_documents")
    .select("id, family_id, title, document_type, document_date, created_at, analysis_summary, raw_text")
    .eq("id", id)
    .maybeSingle();

  if (!doc) notFound();

  // L'analysis_summary contient le JSON Claude (DocumentAnalysisResult)
  const analysis = doc.analysis_summary as unknown as DocumentAnalysisResult | null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link
        href="/timeline"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-700" />
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-strong text-body">
            {doc.document_type}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-ink">{doc.title}</h1>
        <p className="text-sm text-muted">
          {doc.document_date
            ? `Document daté du ${formatDateFr(doc.document_date)}`
            : "Date du document inconnue"}
          {" · "}analysé le {formatDateFr(doc.created_at)}
        </p>
      </header>

      {analysis ? (
        <AnalysisTabs result={analysis} />
      ) : (
        <div className="rounded-xl border border-hairline bg-surface-card p-6 text-center">
          <p className="text-sm text-muted">
            Aucune analyse Claude disponible pour ce document.
          </p>
          <p className="text-xs text-muted mt-1">
            Ce document a peut-être été créé avant la fonctionnalité d&apos;analyse.
          </p>
        </div>
      )}

      {doc.raw_text && (
        <details className="rounded-xl border border-hairline bg-canvas-soft p-4">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">
            Voir le texte source du document
          </summary>
          <pre className="mt-3 text-xs text-body whitespace-pre-wrap font-mono max-h-96 overflow-auto">
            {doc.raw_text}
          </pre>
        </details>
      )}
    </div>
  );
}
