import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AnalysisTabs from "@/components/analyzer/AnalysisTabs";
import DecisionsSection from "@/components/decisions/DecisionsSection";
import PrescriptionsSection from "@/components/medications/PrescriptionsSection";
import type { DocumentAnalysisResult } from "@/lib/prompts";
import type { DecisionRow } from "@/lib/decisions";
import type { Medication } from "@/lib/medications-helpers";
import type { CareTeamMember } from "@/lib/care-team";
import { formatDateFr, formatDateShort } from "@/lib/dates";
import { ArrowLeft, FileText, Download, User, GitBranch } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Page détail d'un document médical : ré-affiche l'analyse Claude (4 onglets)
 * directement depuis le JSONB stocké en base. Pas de nouvel appel Claude.
 * Si un PDF source est stocké (storage_path), affiche un bouton de téléchargement.
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
    .select(
      "id, family_id, title, document_type, document_date, created_at, analysis_summary, raw_text, doctor_name, storage_path",
    )
    .eq("id", id)
    .maybeSingle();

  if (!doc) notFound();

  const analysis = doc.analysis_summary as unknown as DocumentAnalysisResult | null;

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: decisions },
    { data: upcomingConsults },
    { data: existingMedications },
    { data: cancerProfile },
  ] = await Promise.all([
    supabase
      .from("decisions")
      .select("*")
      .eq("source_document_id", id)
      .order("status", { ascending: true })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("consultations")
      .select("id, consultation_date, consultation_type, doctor_name")
      .eq("family_id", doc.family_id)
      .eq("status", "upcoming")
      .gte("consultation_date", today)
      .order("consultation_date", { ascending: true })
      .limit(10),
    supabase
      .from("medications")
      .select("*")
      .eq("family_id", doc.family_id)
      .order("status", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("cancer_profiles")
      .select("care_team")
      .eq("family_id", doc.family_id)
      .maybeSingle(),
  ]);

  const careTeam = (cancerProfile?.care_team as unknown as CareTeamMember[]) ?? [];
  const prescriptions = analysis?.prescriptions ?? [];

  // Si on a un PDF stocké, générer une URL signée (1h) pour le téléchargement
  let downloadUrl: string | null = null;
  if (doc.storage_path) {
    const { data: signed } = await supabase.storage
      .from("medical-documents")
      .createSignedUrl(doc.storage_path, 3600, {
        download: `${doc.title.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`,
      });
    downloadUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link
        href="/timeline"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </Link>

      <header className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-700 shrink-0" />
              <span className="badge-pill">{doc.document_type}</span>
            </div>
            {/* Suffix `!` : la règle globale `h1 { font-size: 48px }` dans
                globals.css est hors @layer et bat les utilitaires Tailwind sans
                ça. Pas de line-clamp : sur mobile, le titre prend autant de
                lignes que nécessaire ; le bouton Télécharger passe en dessous
                grâce au flex-col mobile. */}
            <h1
              className="text-lg! md:text-xl! leading-snug! font-semibold text-ink"
              title={doc.title}
            >
              {doc.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>
                {doc.document_date
                  ? formatDateShort(doc.document_date)
                  : "Date inconnue"}
              </span>
              {doc.doctor_name && (
                <>
                  <span className="text-muted-soft">·</span>
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {doc.doctor_name}
                  </span>
                </>
              )}
              <span className="text-muted-soft">·</span>
              <span>analysé le {formatDateFr(doc.created_at)}</span>
              {decisions && decisions.length > 0 && (
                <>
                  <span className="text-muted-soft">·</span>
                  <span className="inline-flex items-center gap-1 text-purple-600">
                    <GitBranch className="w-3.5 h-3.5" />
                    {decisions.filter((d) => d.status === "pending").length}/
                    {decisions.length} décision
                    {decisions.length > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>
          {downloadUrl && (
            <a
              href={downloadUrl}
              className="btn-outline text-xs h-9 px-4 self-start shrink-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger le PDF
            </a>
          )}
        </div>

        {!downloadUrl && doc.storage_path && (
          <p className="text-xs text-warning">
            PDF stocké mais URL non générable pour le moment. Réessayez plus tard.
          </p>
        )}
        {!doc.storage_path && (
          <p className="text-xs text-muted-soft italic">
            PDF source non disponible pour ce document (analysé avant le stockage permanent).
          </p>
        )}
      </header>

      {analysis ? (
        <AnalysisTabs result={analysis} hideTitle />
      ) : (
        <div className="rounded-xl border border-hairline bg-surface-card p-6 text-center">
          <p className="text-sm text-muted">
            Aucune analyse Claude disponible pour ce document.
          </p>
        </div>
      )}

      {decisions && decisions.length > 0 && (
        <DecisionsSection
          decisions={decisions as unknown as DecisionRow[]}
          sourceLabel="par ce document"
          upcomingConsultations={(upcomingConsults ?? []).map((c) => ({
            id: c.id,
            consultation_date: c.consultation_date,
            consultation_type: c.consultation_type,
            doctor_name: c.doctor_name,
          }))}
        />
      )}

      {prescriptions.length > 0 && (
        <PrescriptionsSection
          prescriptions={prescriptions}
          existingMedications={(existingMedications ?? []) as Medication[]}
          careTeam={careTeam}
          documentDoctor={doc.doctor_name}
        />
      )}

      {doc.raw_text && !doc.raw_text.startsWith("[PDF scanné") && (
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
