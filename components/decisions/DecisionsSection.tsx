"use client";

import { useState } from "react";
import { formatDateFr } from "@/lib/dates";
import { getCategoryMeta, type DecisionRow } from "@/lib/decisions";
import { AlertTriangle, Check, Circle, GitBranch, Users } from "lucide-react";
import DecideDecisionModal from "./DecideDecisionModal";
import UrgencyBadge from "./UrgencyBadge";

interface UpcomingConsultation {
  id: string;
  consultation_date: string;
  consultation_type: string | null;
  doctor_name: string | null;
}

interface Props {
  decisions: DecisionRow[];
  sourceLabel?: string;
  upcomingConsultations?: UpcomingConsultation[];
}

/**
 * Affiche les décisions liées à un document ou une consultation. La modal
 * "Acter" est partagée avec la page /decisions (4 chemins).
 */
export default function DecisionsSection({
  decisions,
  sourceLabel,
  upcomingConsultations = [],
}: Props) {
  const [active, setActive] = useState<DecisionRow | null>(null);
  if (decisions.length === 0) return null;

  const pending = decisions.filter((d) => d.status === "pending");
  const others = decisions.filter((d) => d.status !== "pending");

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
        {others.map((d) => (
          <DecisionCard key={d.id} decision={d} onActer={() => setActive(d)} />
        ))}
      </ul>

      {active && (
        <DecideDecisionModal
          decision={active}
          upcomingConsultations={upcomingConsultations}
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
  const hasObs = (d.obsolescence_signals ?? []).length > 0;

  return (
    <li
      className={`rounded-lg border p-3 ${
        d.status === "obsolete"
          ? "border-hairline bg-canvas-soft opacity-70"
          : hasObs
            ? "border-warning/40 bg-warning/5"
            : isPending
              ? "border-warning/30 bg-warning/5"
              : d.status === "decided"
                ? "border-success/30 bg-success/5"
                : d.status === "awaiting_team"
                  ? "border-blue-500/30 bg-blue-500/5"
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
            <UrgencyBadge dueDate={d.due_date} />
            {d.priority === "high" && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/30">
                Prioritaire
              </span>
            )}
            {d.status === "pending" && !hasObs && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">
                À trancher
              </span>
            )}
            {hasObs && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">
                <AlertTriangle className="w-3 h-3" /> Possiblement caduque
              </span>
            )}
            {d.status === "awaiting_team" && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/30">
                <Users className="w-3 h-3" /> Attente équipe
              </span>
            )}
            {d.status === "decided" && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30">
                <Check className="w-3 h-3" /> Décidée
              </span>
            )}
            {d.status === "obsolete" && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-strong text-muted">
                Caduque
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
                <span className="text-muted">Choix :</span>{" "}
                {d.chosen_option ?? d.external_response_summary}
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

          {d.status === "awaiting_team" && d.team_note && (
            <p className="mt-1.5 text-xs text-muted italic">
              Note équipe : {d.team_note}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onActer}
          className={`shrink-0 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            isPending || hasObs
              ? "border-ink bg-ink text-canvas hover:bg-ink/90"
              : "border-hairline-strong text-body hover:text-ink"
          }`}
        >
          {isPending || hasObs ? "Acter" : "Modifier"}
        </button>
      </div>
    </li>
  );
}
