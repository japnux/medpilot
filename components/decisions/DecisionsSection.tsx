"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formatDateFr } from "@/lib/dates";
import {
  DECIDED_BY_OPTIONS,
  getCategoryMeta,
  type DecisionRow,
} from "@/lib/decisions";
import { Check, Circle, GitBranch, X } from "lucide-react";

interface Props {
  /** Décisions liées au document (ou à la consultation) source. */
  decisions: DecisionRow[];
  /** Label de la source pour titrer la section. */
  sourceLabel?: string;
}

/**
 * Section décisions : affiche les choix soulevés par un document ou une
 * consultation, avec un modal pour acter chaque décision (option choisie,
 * rationale, qui a tranché, date). À l'enregistrement, crée aussi un
 * timeline_event type=decision lié à la source.
 */
export default function DecisionsSection({ decisions, sourceLabel }: Props) {
  const [active, setActive] = useState<DecisionRow | null>(null);

  if (decisions.length === 0) return null;

  const pending = decisions.filter((d) => d.status === "pending");
  const decided = decisions.filter((d) => d.status === "decided");
  const other = decisions.filter(
    (d) => d.status !== "pending" && d.status !== "decided",
  );

  return (
    <section className="rounded-xl border border-hairline bg-surface-card p-5 space-y-4">
      <header className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-purple-600" />
        <h2 className="text-base font-medium text-ink">
          Décisions {sourceLabel ? `soulevées ${sourceLabel}` : "à trancher"}
        </h2>
        {pending.length > 0 && (
          <span className="ml-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">
            {pending.length} en attente
          </span>
        )}
      </header>

      <ul className="space-y-2">
        {pending.map((d) => (
          <DecisionCard key={d.id} decision={d} onActer={() => setActive(d)} />
        ))}
        {decided.map((d) => (
          <DecisionCard key={d.id} decision={d} onActer={() => setActive(d)} />
        ))}
        {other.map((d) => (
          <DecisionCard key={d.id} decision={d} onActer={() => setActive(d)} />
        ))}
      </ul>

      {active && (
        <DecideModal
          decision={active}
          onClose={() => setActive(null)}
        />
      )}
    </section>
  );
}

function DecisionCard({
  decision: d,
  onActer,
}: {
  decision: DecisionRow;
  onActer: () => void;
}) {
  const meta = getCategoryMeta(d.category);
  const Icon = meta.icon;
  const isPending = d.status === "pending";

  return (
    <li
      className={`rounded-lg border p-3 ${
        isPending
          ? "border-warning/30 bg-warning/5"
          : d.status === "decided"
            ? "border-success/30 bg-success/5"
            : "border-hairline bg-canvas-soft"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${meta.color}1a` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: meta.color,
                backgroundColor: `${meta.color}1a`,
                border: `1px solid ${meta.color}40`,
              }}
            >
              {meta.label}
            </span>
            {d.priority === "high" && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/30">
                Prioritaire
              </span>
            )}
            {d.status === "pending" && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">
                À trancher
              </span>
            )}
            {d.status === "decided" && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30">
                <Check className="w-3 h-3" /> Décidée
              </span>
            )}
            {d.status === "abandoned" && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-strong text-muted">
                Abandonnée
              </span>
            )}
            {d.due_date && d.status === "pending" && (
              <span className="text-[10px] text-muted">
                Échéance {formatDateFr(d.due_date)}
              </span>
            )}
          </div>

          <h3 className="text-sm font-medium text-ink">{d.title}</h3>
          {d.question && (
            <p className="text-xs text-body mt-0.5">{d.question}</p>
          )}

          {d.options.length > 0 && d.status === "pending" && (
            <ul className="mt-2 space-y-1">
              {d.options.map((o, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  <Circle className="w-3 h-3 text-muted shrink-0 mt-0.5" />
                  <span className="text-body">
                    {o.label}
                    {o.recommended && (
                      <span className="ml-1.5 text-[10px] text-success">
                        ✓ recommandée
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {d.status === "decided" && (
            <div className="mt-2 text-xs space-y-0.5">
              <p className="text-body-strong">
                <span className="text-muted">Choix :</span> {d.chosen_option}
              </p>
              {d.rationale && (
                <p className="text-muted italic">« {d.rationale} »</p>
              )}
              <p className="text-muted">
                {d.decided_by && <span>par {d.decided_by} · </span>}
                {d.decided_at && <span>{formatDateFr(d.decided_at)}</span>}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onActer}
          className={`shrink-0 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            isPending
              ? "border-ink bg-ink text-canvas hover:bg-ink/90"
              : "border-hairline-strong text-body hover:text-ink"
          }`}
        >
          {isPending ? "Acter" : "Modifier"}
        </button>
      </div>
    </li>
  );
}

function DecideModal({
  decision,
  onClose,
}: {
  decision: DecisionRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [chosenOption, setChosenOption] = useState(decision.chosen_option ?? "");
  const [customOption, setCustomOption] = useState("");
  const [rationale, setRationale] = useState(decision.rationale ?? "");
  const [decidedBy, setDecidedBy] = useState(decision.decided_by ?? "patient");
  const [decidedAt, setDecidedAt] = useState(
    decision.decided_at ?? new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCustom = chosenOption === "__custom__";
  const finalChoice = useCustom ? customOption.trim() : chosenOption;

  async function submit() {
    if (!finalChoice) {
      setError("Indique l'option choisie.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: upErr } = await supabase
        .from("decisions")
        .update({
          status: "decided",
          chosen_option: finalChoice,
          rationale: rationale.trim() || null,
          decided_by: decidedBy,
          decided_at: decidedAt,
        })
        .eq("id", decision.id);
      if (upErr) throw upErr;

      // Timeline event lié pour rendre la décision visible chronologiquement
      await supabase.from("timeline_events").insert({
        family_id: decision.family_id,
        event_type: "decision",
        event_date: decidedAt,
        title: `Décision : ${decision.title}`,
        summary: `${finalChoice}${rationale ? ` — ${rationale}` : ""}`,
        is_critical: decision.priority === "high",
        linked_document_id: decision.source_document_id,
        linked_consultation_id: decision.source_consultation_id,
      });

      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function abandon() {
    if (!confirm("Marquer cette décision comme abandonnée ?")) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from("decisions")
        .update({ status: "abandoned" })
        .eq("id", decision.id);
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-canvas rounded-xl border border-hairline shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-hairline">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted">
              Acter la décision
            </p>
            <h3 className="text-base font-medium text-ink truncate">
              {decision.title}
            </h3>
            {decision.question && (
              <p className="text-xs text-body mt-0.5">{decision.question}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-surface-card flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Option choisie
            </label>
            <div className="space-y-1.5">
              {decision.options.map((o, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    chosenOption === o.label
                      ? "border-ink bg-surface-card"
                      : "border-hairline hover:bg-surface-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="option"
                    value={o.label}
                    checked={chosenOption === o.label}
                    onChange={() => setChosenOption(o.label)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {o.label}
                      {o.recommended && (
                        <span className="ml-1.5 text-[10px] text-success">
                          ✓ recommandée
                        </span>
                      )}
                    </p>
                    {(o.pros?.length || o.cons?.length) && (
                      <div className="mt-1 text-[11px] space-y-0.5">
                        {o.pros?.map((p, j) => (
                          <p key={`p${j}`} className="text-success">
                            + {p}
                          </p>
                        ))}
                        {o.cons?.map((c, j) => (
                          <p key={`c${j}`} className="text-warning">
                            − {c}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
              <label
                className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  useCustom
                    ? "border-ink bg-surface-card"
                    : "border-hairline hover:bg-surface-card"
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  value="__custom__"
                  checked={useCustom}
                  onChange={() => setChosenOption("__custom__")}
                />
                <span className="text-sm text-body">Autre choix (libre)</span>
              </label>
              {useCustom && (
                <input
                  type="text"
                  value={customOption}
                  onChange={(e) => setCustomOption(e.target.value)}
                  placeholder="Décris le choix retenu"
                  className="w-full text-sm border border-hairline rounded-md px-3 py-2 mt-1"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Pourquoi ce choix (rationale)
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Ex : Régis a accepté après l'explication du Pr Baudin, profil haut risque sans contre-indication."
              className="w-full text-sm border border-hairline rounded-md px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Décidé par
              </label>
              <select
                value={decidedBy}
                onChange={(e) => setDecidedBy(e.target.value)}
                className="w-full text-sm border border-hairline rounded-md px-3 py-2 bg-canvas"
              >
                {DECIDED_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={decidedAt}
                onChange={(e) => setDecidedAt(e.target.value)}
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 p-4 border-t border-hairline">
          <button
            type="button"
            onClick={abandon}
            disabled={saving}
            className="text-xs text-muted hover:text-error disabled:opacity-50"
          >
            Abandonner
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs px-3 py-2 rounded-md border border-hairline-strong text-body hover:text-ink"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="text-xs px-3 py-2 rounded-md bg-ink text-canvas hover:bg-ink/90 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer la décision"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
