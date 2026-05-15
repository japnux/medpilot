"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { DocumentAnalysisResult } from "@/lib/prompts";
import AnalysisTabs from "./AnalysisTabs";
import { Upload, FileText, Save } from "lucide-react";

interface Props {
  familyId: string;
  history: Array<{
    id: string;
    title: string;
    document_date: string | null;
    document_type: string;
    created_at: string;
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
  const [pdfInfo, setPdfInfo] = useState<{ name: string; pages: number; chars: number } | null>(null);

  async function handlePdf(file: File) {
    setError(null);
    setParsingPdf(true);
    setPdfInfo(null);
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
      if (extracted.length < 20) {
        setError(
          `Ce PDF semble être un scan / image (${j.pages ?? "?"} page${j.pages > 1 ? "s" : ""}, ${extracted.length} caractères extraits). Collez le texte manuellement ci-dessous.`,
        );
        return;
      }
      setText(extracted);
      setPdfInfo({
        name: file.name,
        pages: j.pages ?? 0,
        chars: extracted.length,
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

  async function analyze() {
    if (text.trim().length < 20) {
      setError("Document trop court.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch("/api/claude/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_id: familyId, text }),
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
          raw_text: text,
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
        <h1 className="text-2xl font-semibold text-white">Analyser un document</h1>
        <p className="text-sm text-slate-400 mt-1">
          Glissez un PDF ou collez le texte. L&apos;analyse contextualise par
          rapport au profil du patient.
        </p>
      </div>

      {/* Dropzone + textarea */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <label
          htmlFor="pdf-input"
          className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            parsingPdf
              ? "border-indigo-500 bg-indigo-500/5"
              : pdfInfo
                ? "border-emerald-700/40 bg-emerald-900/10"
                : "border-slate-700 hover:border-slate-600"
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
          <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          {parsingPdf ? (
            <p className="text-sm text-indigo-300">Extraction du PDF en cours...</p>
          ) : pdfInfo ? (
            <>
              <p className="text-sm text-emerald-300">
                ✓ {pdfInfo.name}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {pdfInfo.pages} page{pdfInfo.pages > 1 ? "s" : ""} · {pdfInfo.chars.toLocaleString()} caractères extraits — cliquez pour changer
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                Cliquez pour choisir un PDF ou glissez-déposez ici
              </p>
              <p className="text-xs text-slate-500 mt-1">
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

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ou collez ici le texte du document médical à analyser..."
          rows={10}
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none font-mono"
        />

        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-500">
            {text.length} caractères · analyse via Claude Opus 4.7
          </p>
          <button
            onClick={analyze}
            disabled={analyzing || text.trim().length < 20}
            className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium text-white"
          >
            {analyzing ? "Analyse en cours…" : "Analyser"}
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {result && (
        <>
          <AnalysisTabs result={result} />
          <div className="flex justify-end gap-2">
            <button
              onClick={save}
              disabled={saving || saved}
              className="flex items-center gap-2 h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-medium text-white"
            >
              <Save className="w-4 h-4" />
              {saved ? "Enregistré" : saving ? "Enregistrement…" : "Sauvegarder dans le dossier"}
            </button>
          </div>
        </>
      )}

      {/* Historique */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-white">
          Historique ({history.length})
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Aucun document analysé pour le moment.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/40">
            {history.map((d) => (
              <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{d.title}</p>
                  <p className="text-xs text-slate-500">
                    {d.document_type} · {d.document_date ?? "date inconnue"}
                  </p>
                </div>
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
