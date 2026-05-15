"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { DocumentAnalysisResult } from "@/lib/prompts";
import AnalysisTabs from "./AnalysisTabs";
import { Upload, FileText, Save, Loader2, ChevronRight } from "lucide-react";
import { formatDateShort } from "@/lib/dates";

interface Props {
  familyId: string;
  history: Array<{
    id: string;
    title: string;
    document_date: string | null;
    document_type: string;
    created_at: string;
    doctor_name: string | null;
  }>;
}

export default function AnalyzerClient({ familyId, history }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{
    name: string;
    pages: number;
    chars: number;
    /** Base64 du PDF si le texte n'a pas pu être extrait (scan). À envoyer direct à Claude. */
    base64?: string;
  } | null>(null);

  async function handlePdf(file: File) {
    setError(null);
    setParsingPdf(true);
    setPdfInfo(null);
    setText("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/claude/parse-pdf", {
        method: "POST",
        body: form,
      });
      const j = await res.json();
      if (!res.ok) {
        setError(`${j.error}. Collez le texte manuellement ci-dessous.`);
        return;
      }
      const extracted = (j.text ?? "").trim();

      // Cas 1 : extraction texte réussie → on l'utilise (moins coûteux en tokens)
      if (extracted.length >= 20) {
        setText(extracted);
        setPdfInfo({
          name: file.name,
          pages: j.pages ?? 0,
          chars: extracted.length,
        });
        return;
      }

      // Cas 2 : PDF scanné, pas de texte → on garde le base64 pour envoi direct à Claude
      const base64 = await fileToBase64(file);
      setPdfInfo({
        name: file.name,
        pages: j.pages ?? 0,
        chars: 0,
        base64,
      });
    } catch (e) {
      console.error("PDF parse error", e);
      setError(
        `Impossible de lire le PDF (${e instanceof Error ? e.message : "erreur réseau"}). Collez le texte manuellement.`,
      );
    } finally {
      setParsingPdf(false);
    }
  }

  /** Convertit un File en base64 sans préfixe data:. */
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // result = "data:application/pdf;base64,JVBE..."
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function analyze() {
    const hasText = text.trim().length >= 20;
    const hasPdf = !!pdfInfo?.base64;
    if (!hasText && !hasPdf) {
      setError("Collez du texte ou choisissez un PDF (≥20 caractères).");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = { family_id: familyId };
      if (hasText) {
        body.text = text;
      } else if (hasPdf) {
        body.pdf_base64 = pdfInfo!.base64;
        body.pdf_name = pdfInfo!.name;
      }
      const res = await fetch("/api/claude/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur d'analyse");
      setResult(j.json as DocumentAnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: doc, error: docErr } = await supabase
        .from("medical_documents")
        .insert({
          family_id: familyId,
          document_type: validateDocType(result.document_type),
          document_date: result.document_date,
          title: result.title,
          raw_text: text || (pdfInfo?.base64
            ? `[PDF scanné — ${pdfInfo.name}, ${pdfInfo.pages} pages — analysé directement par Claude vision]`
            : ""),
          doctor_name: result.doctor_name ?? null,
          analysis_summary: JSON.parse(JSON.stringify(result)),
        })
        .select("id")
        .single();
      if (docErr) throw docErr;

      // Événement timeline lié
      await supabase.from("timeline_events").insert({
        family_id: familyId,
        event_type: mapDocTypeToEvent(result.document_type),
        event_date: result.document_date ?? new Date().toISOString().slice(0, 10),
        title: result.title,
        summary: result.summary_family,
        is_critical: result.action_required,
        linked_document_id: doc.id,
      });

      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Analyser un document</h1>
        <p className="text-sm text-muted mt-1">
          Glissez un PDF ou collez le texte. L&apos;analyse contextualise par
          rapport au profil du patient.
        </p>
      </div>

      {/* Dropzone + textarea */}
      <div className="rounded-xl border border-hairline bg-surface-card p-4 space-y-3">
        <label
          htmlFor="pdf-input"
          className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            parsingPdf
              ? "border-ink bg-canvas-soft"
              : pdfInfo
                ? "border-success/30 bg-success/5"
                : "border-hairline-strong hover:border-hairline-strong"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f && f.type === "application/pdf") handlePdf(f);
          }}
        >
          <Upload className="w-6 h-6 text-muted mx-auto mb-2" />
          {parsingPdf ? (
            <p className="text-sm text-ink flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lecture du PDF en cours...
            </p>
          ) : pdfInfo ? (
            <>
              <p className="text-sm text-success">
                ✓ {pdfInfo.name}
              </p>
              <p className="text-xs text-muted mt-1">
                {pdfInfo.pages} page{pdfInfo.pages > 1 ? "s" : ""}
                {pdfInfo.base64
                  ? " · PDF scanné → sera lu directement par Claude (vision)"
                  : ` · ${pdfInfo.chars.toLocaleString()} caractères extraits`}
                {" — cliquez pour changer"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-body">
                Cliquez pour choisir un PDF ou glissez-déposez ici
              </p>
              <p className="text-xs text-muted mt-1">
                Si l&apos;extraction échoue (PDF scanné), collez le texte ci-dessous.
              </p>
            </>
          )}
          <input
            id="pdf-input"
            type="file"
            accept="application/pdf"
            disabled={parsingPdf}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePdf(f);
              // Reset input pour permettre de re-sélectionner le même fichier
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        <div className="flex justify-between items-center">
          <p className="text-xs text-muted">
            {pdfInfo?.base64
              ? `PDF (${pdfInfo.pages} p.) · analyse via Claude Opus 4.7 (vision)`
              : pdfInfo
                ? `${pdfInfo.chars.toLocaleString()} caractères extraits · Claude Opus 4.7`
                : "Choisissez un PDF pour démarrer"}
          </p>
          <button
            onClick={analyze}
            disabled={analyzing || !pdfInfo}
            className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-sm font-medium text-on-primary"
          >
            {analyzing && <Loader2 className="w-4 h-4 animate-spin" />}
            {analyzing ? "Analyse en cours…" : "Analyser"}
          </button>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}
      </div>

      {analyzing && (
        <div className="rounded-xl border border-hairline-strong bg-canvas-soft p-6 flex items-center gap-4">
          <Loader2 className="w-6 h-6 text-ink animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-ink">
              Claude Opus 4.7 analyse le document...
            </p>
            <p className="text-xs text-ink/70 mt-0.5">
              {pdfInfo?.base64
                ? "Lecture en vision d'un PDF scanné — peut prendre 30 à 60 secondes."
                : "Analyse en cours — quelques secondes."}
            </p>
          </div>
        </div>
      )}

      {result && (
        <>
          <AnalysisTabs result={result} />
          <div className="flex justify-end gap-2">
            <button
              onClick={save}
              disabled={saving || saved}
              className="flex items-center gap-2 h-10 px-5 rounded-lg bg-success hover:bg-success disabled:opacity-40 text-sm font-medium text-on-primary"
            >
              <Save className="w-4 h-4" />
              {saved ? "Enregistré" : saving ? "Enregistrement…" : "Sauvegarder dans le dossier"}
            </button>
          </div>
        </>
      )}

      {/* Historique */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink">
          Historique ({history.length})
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-muted italic">Aucun document analysé pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/documents/${d.id}`}
                  className="block rounded-xl border border-hairline bg-surface-card hover:bg-surface-strong p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm text-ink">{d.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Pill date */}
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-surface-strong text-body border border-hairline-strong">
                          {d.document_date
                            ? formatDateShort(d.document_date)
                            : "Date inconnue"}
                        </span>
                        {/* Pill type */}
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-surface-strong text-body border border-hairline-strong">
                          {d.document_type}
                        </span>
                        {/* Pill médecin (si disponible) */}
                        {d.doctor_name && (
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-surface-strong text-ink border border-ink">
                            {d.doctor_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-soft shrink-0 mt-1" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const ALLOWED_DOC_TYPES = [
  "anapath",
  "biologie",
  "imagerie",
  "courrier",
  "ordonnance",
  "compte_rendu_op",
  "rcp",
  "genetique",
  "autre",
] as const;

function validateDocType(t: string): (typeof ALLOWED_DOC_TYPES)[number] {
  return ALLOWED_DOC_TYPES.includes(t as (typeof ALLOWED_DOC_TYPES)[number])
    ? (t as (typeof ALLOWED_DOC_TYPES)[number])
    : "autre";
}

function mapDocTypeToEvent(docType: string):
  | "anapath"
  | "biology"
  | "imaging"
  | "consultation"
  | "rcp"
  | "other" {
  switch (docType) {
    case "anapath":
      return "anapath";
    case "biologie":
      return "biology";
    case "imagerie":
      return "imaging";
    case "compte_rendu_op":
      return "consultation";
    case "rcp":
      return "rcp";
    default:
      return "other";
  }
}
