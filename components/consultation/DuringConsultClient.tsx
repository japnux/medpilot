"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { ConsultationPrepResult } from "@/lib/prompts";
import { formatDateFr } from "@/lib/dates";
import {
  ArrowLeft,
  CheckCircle,
  GitBranch,
  Pencil,
  Check,
} from "lucide-react";
import Link from "next/link";
import EditConsultationModal from "./EditConsultationModal";

interface Consultation {
  id: string;
  family_id: string;
  consultation_date: string;
  doctor_name: string | null;
  consultation_type: string | null;
  hospital: string | null;
  prepared_questions: ConsultationPrepResult | null;
  notes_during: string | null;
  status: string;
}

interface Props {
  consultation: Consultation;
  /** Compteur affiché en header : { pending, total } décisions liées. */
  decisionCounts?: { pending: number; total: number };
  /** Noms du care_team (datalist du modal d'édition). */
  careTeamNames?: string[];
}

/**
 * Page détail d'une consultation. Centré sur la prise de notes inline
 * pour chaque question préparée pendant le RDV. Auto-save 800ms après
 * la dernière frappe par question (les autres champs idem sur blur).
 */
export default function DuringConsultClient({
  consultation,
  decisionCounts,
  careTeamNames = [],
}: Props) {
  const router = useRouter();
  const prep = consultation.prepared_questions;
  const [questions, setQuestions] = useState(prep?.questions ?? []);
  const [notes, setNotes] = useState(consultation.notes_during ?? "");
  const [savingState, setSavingState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completed = consultation.status === "completed";

  /** Patch prepared_questions en BDD avec les réponses actuelles. */
  const persistQuestions = useCallback(
    async (next: typeof questions) => {
      setSavingState("saving");
      setError(null);
      try {
        const supabase = createClient();
        const payload = prep
          ? { ...prep, questions: next }
          : { consultation_summary: "", questions: next };
        const { error: e } = await supabase
          .from("consultations")
          .update({ prepared_questions: JSON.parse(JSON.stringify(payload)) })
          .eq("id", consultation.id);
        if (e) throw e;
        setSavingState("saved");
        setTimeout(() => setSavingState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (e) {
        setSavingState("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    },
    [consultation.id, prep],
  );

  /** Update une réponse + debounce 800ms pour persister. */
  function updateAnswer(idx: number, answer: string) {
    const next = questions.map((q, i) => (i === idx ? { ...q, answer } : q));
    setQuestions(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistQuestions(next), 800);
  }

  /** Sauve les notes globales (au blur). */
  async function saveNotes() {
    setSavingState("saving");
    setError(null);
    try {
      const supabase = createClient();
      const { error: e } = await supabase
        .from("consultations")
        .update({ notes_during: notes })
        .eq("id", consultation.id);
      if (e) throw e;
      setSavingState("saved");
      setTimeout(() => setSavingState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (e) {
      setSavingState("error");
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function markCompleted() {
    setSavingState("saving");
    setError(null);
    try {
      const supabase = createClient();
      // Flush des éventuelles modifs en attente
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        await persistQuestions(questions);
      }
      const { error: e1 } = await supabase
        .from("consultations")
        .update({ status: "completed", notes_during: notes })
        .eq("id", consultation.id);
      if (e1) throw e1;
      router.push("/consultation");
      router.refresh();
    } catch (e) {
      setSavingState("error");
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/consultation"
        className="flex items-center gap-1.5 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </Link>

      <header>
        <div className="flex items-center justify-between gap-3 flex-wrap pr-12 md:pr-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-ink">
              Consultation {consultation.consultation_type ?? ""}
            </h1>
            {completed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/10 text-success border border-success/30">
                <CheckCircle className="w-3 h-3" /> Terminée
              </span>
            )}
            {savingState === "saving" && (
              <span className="text-[11px] text-muted italic">
                Enregistrement…
              </span>
            )}
            {savingState === "saved" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-success">
                <Check className="w-3 h-3" />
                Enregistré
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-hairline-strong text-body hover:text-ink hover:bg-surface-card"
          >
            <Pencil className="w-3.5 h-3.5" />
            Modifier
          </button>
        </div>
        <p className="text-sm text-muted mt-1">
          {formatDateFr(consultation.consultation_date)}
          {consultation.doctor_name && ` · ${consultation.doctor_name}`}
          {consultation.hospital && ` · ${consultation.hospital}`}
          {decisionCounts && decisionCounts.total > 0 && (
            <>
              {" · "}
              <a
                href="#decisions-section"
                className="inline-flex items-center gap-1 text-purple-600 hover:underline"
              >
                <GitBranch className="w-3.5 h-3.5" />
                {decisionCounts.pending}/{decisionCounts.total} décision
                {decisionCounts.total > 1 ? "s" : ""}
              </a>
            </>
          )}
        </p>
      </header>

      {prep?.consultation_summary && (
        <section className="rounded-xl border border-hairline bg-canvas-soft p-4">
          <p className="text-sm text-body italic">
            {prep.consultation_summary}
          </p>
        </section>
      )}

      {/* Liste des questions avec réponse inline */}
      {questions.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-ink">
              Questions ({questions.length})
            </h2>
            <span className="text-[11px] text-muted">
              · Note la réponse sous chaque question pendant le RDV
            </span>
          </div>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <QuestionWithAnswer
                key={i}
                index={i}
                theme={q.theme}
                question={q.question}
                priority={q.priority}
                context={q.context}
                answer={q.answer ?? ""}
                disabled={completed}
                onAnswerChange={(v) => updateAnswer(i, v)}
              />
            ))}
          </ol>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-hairline bg-canvas-soft p-8 text-center">
          <p className="text-sm text-muted italic">
            Aucune question préparée. Clique sur <b>Modifier</b> →{" "}
            <b>Enregistrer & re-générer la prep</b> pour en générer.
          </p>
        </section>
      )}

      {/* Sections informatives héritées de la prep */}
      {prep && prep.documents_to_bring && prep.documents_to_bring.length > 0 && (
        <ListSection
          title="Documents à apporter"
          items={prep.documents_to_bring}
        />
      )}
      {prep &&
        prep.watch_for_during_consult &&
        prep.watch_for_during_consult.length > 0 && (
          <ListSection
            title="À documenter pendant le RDV"
            items={prep.watch_for_during_consult}
          />
        )}

      {/* Notes libres en bas */}
      <section className="rounded-xl border border-hairline bg-surface-card p-5 space-y-2">
        <h2 className="text-sm font-medium text-ink">
          Autres observations (optionnel)
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          disabled={completed}
          rows={4}
          placeholder="Notes libres : ressenti du patient, ambiance du RDV, ce qui n'entre pas dans une question…"
          className="w-full text-sm border border-hairline rounded-md px-3 py-2 disabled:opacity-70"
        />
      </section>

      {error && (
        <p className="text-xs text-error rounded-md border border-error/30 bg-error/5 p-2">
          {error}
        </p>
      )}

      {!completed && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={markCompleted}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-success text-canvas text-sm font-medium hover:opacity-90"
          >
            <CheckCircle className="w-4 h-4" />
            Marquer comme terminée
          </button>
        </div>
      )}

      {editing && (
        <EditConsultationModal
          consultation={{
            id: consultation.id,
            family_id: consultation.family_id,
            consultation_date: consultation.consultation_date,
            consultation_type: consultation.consultation_type,
            doctor_name: consultation.doctor_name,
            hospital: consultation.hospital,
          }}
          careTeamNames={careTeamNames}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function QuestionWithAnswer({
  index,
  theme,
  question,
  priority,
  context,
  answer,
  disabled,
  onAnswerChange,
}: {
  index: number;
  theme: string;
  question: string;
  priority: "high" | "normal";
  context: string;
  answer: string;
  disabled: boolean;
  onAnswerChange: (v: string) => void;
}) {
  const hasAnswer = answer.trim().length > 0;
  return (
    <li
      className={`rounded-lg border p-3 ${
        hasAnswer
          ? "border-success/30 bg-success/5"
          : "border-hairline bg-surface-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-medium ${
            hasAnswer
              ? "bg-success text-canvas"
              : "bg-canvas-soft text-muted border border-hairline"
          }`}
        >
          {hasAnswer ? <Check className="w-3.5 h-3.5" /> : index + 1}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-canvas border border-hairline text-muted">
              {theme}
            </span>
            {priority === "high" && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/30">
                Prioritaire
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-ink">{question}</p>
          {context && (
            <p className="text-xs text-muted italic">{context}</p>
          )}
          <textarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder="Note la réponse du médecin ici…"
            className="w-full text-sm border border-hairline rounded-md px-3 py-2 mt-1 disabled:opacity-70 bg-canvas"
          />
        </div>
      </div>
    </li>
  );
}

function ListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-xl border border-hairline bg-canvas-soft p-4">
      <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
        {title}
      </h3>
      <ul className="space-y-1 text-sm text-body">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
