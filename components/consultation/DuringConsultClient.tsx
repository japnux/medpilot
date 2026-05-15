"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { ConsultationPrepResult } from "@/lib/prompts";
import { formatDateFr } from "@/lib/dates";
import { CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Consultation {
  id: string;
  family_id: string;
  consultation_date: string;
  doctor_name: string | null;
  consultation_type: string | null;
  hospital: string | null;
  prepared_questions: ConsultationPrepResult | null;
  notes_during: string | null;
  decisions_made: string[] | null;
  followup_actions: string[] | null;
  status: string;
}

interface Props {
  consultation: Consultation;
}

export default function DuringConsultClient({ consultation }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(consultation.notes_during ?? "");
  const [decisions, setDecisions] = useState<string[]>(
    consultation.decisions_made ?? [],
  );
  const [followups, setFollowups] = useState<string[]>(
    consultation.followup_actions ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem(list: string[], setter: (v: string[]) => void) {
    setter([...list, ""]);
  }
  function updateItem(
    list: string[],
    setter: (v: string[]) => void,
    i: number,
    v: string,
  ) {
    const next = [...list];
    next[i] = v;
    setter(next);
  }
  function removeItem(list: string[], setter: (v: string[]) => void, i: number) {
    setter(list.filter((_, idx) => idx !== i));
  }

  async function saveNotes() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: e } = await supabase
        .from("consultations")
        .update({
          notes_during: notes,
          decisions_made: decisions.filter((d) => d.trim()),
          followup_actions: followups.filter((f) => f.trim()),
        })
        .eq("id", consultation.id);
      if (e) throw e;
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function markCompleted() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const cleanDecisions = decisions.filter((d) => d.trim());
      const cleanFollowups = followups.filter((f) => f.trim());

      const { error: e1 } = await supabase
        .from("consultations")
        .update({
          status: "completed",
          notes_during: notes,
          decisions_made: cleanDecisions,
          followup_actions: cleanFollowups,
        })
        .eq("id", consultation.id);
      if (e1) throw e1;

      // Mise à jour de l'événement timeline lié
      await supabase
        .from("timeline_events")
        .update({
          summary:
            cleanDecisions.length > 0
              ? `Décisions : ${cleanDecisions.join(" · ")}`
              : notes.slice(0, 200),
        })
        .eq("linked_consultation_id", consultation.id);

      router.push("/timeline");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const prep = consultation.prepared_questions;
  const completed = consultation.status === "completed";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link
        href="/consultation"
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour
      </Link>

      <header>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-white">
            Consultation {consultation.consultation_type}
          </h1>
          {completed && (
            <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-700/30">
              Terminée
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-1">
          {formatDateFr(consultation.consultation_date)}
          {consultation.doctor_name && ` · ${consultation.doctor_name}`}
          {consultation.hospital && ` · ${consultation.hospital}`}
        </p>
      </header>

      {prep && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <h2 className="text-sm font-medium text-white">Questions préparées</h2>
          <ul className="space-y-2">
            {prep.questions.map((q, i) => (
              <li key={i} className="text-sm text-slate-200">
                <span className="text-slate-500 mr-2">•</span>
                {q.question}{" "}
                <span className="text-xs text-slate-500">({q.theme})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Notes pendant */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <h2 className="text-sm font-medium text-white">Notes pendant le RDV</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="Notez ici ce qui est dit pendant la consultation..."
          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Décisions prises</span>
            <button
              onClick={() => addItem(decisions, setDecisions)}
              className="text-xs text-indigo-400"
            >
              + Ajouter
            </button>
          </div>
          {decisions.map((d, i) => (
            <div key={i} className="flex gap-2 mb-1.5">
              <input
                value={d}
                onChange={(e) =>
                  updateItem(decisions, setDecisions, i, e.target.value)
                }
                className="flex-1 h-9 px-2 rounded bg-slate-950 border border-slate-700 text-sm text-white"
              />
              <button
                onClick={() => removeItem(decisions, setDecisions, i)}
                className="px-2 text-xs text-slate-400 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Actions de suivi</span>
            <button
              onClick={() => addItem(followups, setFollowups)}
              className="text-xs text-indigo-400"
            >
              + Ajouter
            </button>
          </div>
          {followups.map((f, i) => (
            <div key={i} className="flex gap-2 mb-1.5">
              <input
                value={f}
                onChange={(e) =>
                  updateItem(followups, setFollowups, i, e.target.value)
                }
                className="flex-1 h-9 px-2 rounded bg-slate-950 border border-slate-700 text-sm text-white"
              />
              <button
                onClick={() => removeItem(followups, setFollowups, i)}
                className="px-2 text-xs text-slate-400 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          {!completed && (
            <button
              onClick={saveNotes}
              disabled={saving}
              className="h-9 px-4 rounded-lg border border-slate-700 hover:border-slate-600 text-sm text-slate-200 disabled:opacity-40"
            >
              {saving ? "..." : "Enregistrer"}
            </button>
          )}
          {!completed && (
            <button
              onClick={markCompleted}
              disabled={saving}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-medium text-white"
            >
              <CheckCircle className="w-4 h-4" />
              Marquer comme terminée
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
