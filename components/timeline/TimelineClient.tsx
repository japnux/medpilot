"use client";

import Link from "next/link";
import { formatDateFr } from "@/lib/dates";
import { getEventMeta } from "@/lib/timeline-events";
import { getCategoryMeta, type DecisionRow } from "@/lib/decisions";
import { AlertCircle, GitBranch } from "lucide-react";

interface TimelineEvent {
  id: string;
  event_type: string;
  event_date: string;
  title: string;
  summary: string | null;
  is_critical: boolean | null;
  linked_document_id: string | null;
  linked_consultation_id: string | null;
}

interface Props {
  familyId: string;
  events: TimelineEvent[];
  pendingDecisions: DecisionRow[];
}

/**
 * Timeline unifiée : axe chronologique vertical, du plus récent au plus ancien.
 * Tous les événements (chirurgie, consultations, documents, biologie) avec dots
 * colorés par type et clic vers la fiche détail. En tête de page, on fait
 * ressortir les décisions encore en attente (pour ne pas qu'elles se perdent
 * dans l'historique).
 */
export default function TimelineClient({ events, pendingDecisions }: Props) {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Timeline du parcours</h1>
        <p className="text-sm text-muted mt-1">
          Tous les événements médicaux, du plus récent au plus ancien.
        </p>
      </header>

      {pendingDecisions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-ink flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-600" />
            Décisions en attente
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">
              {pendingDecisions.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {pendingDecisions.map((d) => (
              <PendingDecisionRow key={d.id} decision={d} />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink border-b border-hairline pb-2">
          Historique du parcours
        </h2>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-canvas-soft p-6 text-center">
            <p className="text-xs text-muted italic">
              Aucun événement encore enregistré. Analysez un document ou ajoutez
              une consultation pour commencer.
            </p>
          </div>
        ) : (
          <div className="relative pl-8 space-y-4">
            {/* Ligne verticale chronologique */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-surface-strong"></div>

            {events.map((e) => (
              <EventItem key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventItem({ event }: { event: TimelineEvent }) {
  const meta = getEventMeta(event.event_type);
  const Icon = meta.icon;

  // Si l'événement est lié à un document ou une consultation, rendre cliquable
  const href = event.linked_document_id
    ? `/documents/${event.linked_document_id}`
    : event.linked_consultation_id
      ? `/consultation/${event.linked_consultation_id}`
      : null;

  const card = (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        event.is_critical
          ? "border-error/30 bg-canvas-soft"
          : "border-hairline bg-surface-card"
      } ${href ? "hover:bg-surface-strong" : ""}`}
    >
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <span className="text-xs text-muted">
          {formatDateFr(event.event_date)}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px]"
          style={{
            color: meta.color,
            backgroundColor: `${meta.color}1a`,
            border: `1px solid ${meta.color}40`,
          }}
        >
          {meta.label}
        </span>
        {event.is_critical && (
          <span className="flex items-center gap-1 text-[10px] text-error">
            <AlertCircle className="w-3 h-3" />
            Critique
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-ink">{event.title}</h3>
      {event.summary && (
        <p className="text-xs text-muted mt-1 line-clamp-3">{event.summary}</p>
      )}
    </div>
  );

  return (
    <article className="relative">
      {/* Dot coloré sur la ligne */}
      <div
        className="absolute -left-8 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-canvas"
        style={{ borderColor: meta.color }}
      >
        <Icon className="w-3 h-3" style={{ color: meta.color }} />
      </div>
      {href ? <Link href={href}>{card}</Link> : card}
    </article>
  );
}

function PendingDecisionRow({ decision: d }: { decision: DecisionRow }) {
  const meta = getCategoryMeta(d.category);
  const Icon = meta.icon;

  const overdue =
    d.due_date && new Date(d.due_date).getTime() < Date.now();

  return (
    <li>
      <Link
        href="/decisions"
        className="block rounded-lg border border-warning/30 bg-warning/5 p-3 hover:bg-warning/10 transition-colors"
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
              {d.due_date && (
                <span
                  className={`text-[10px] ${overdue ? "text-error font-medium" : "text-muted"}`}
                >
                  Échéance {formatDateFr(d.due_date)}
                  {overdue ? " — en retard" : ""}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-ink">{d.title}</p>
            {d.question && (
              <p className="text-xs text-body mt-0.5 line-clamp-2">
                {d.question}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted hover:text-ink">→</span>
        </div>
      </Link>
    </li>
  );
}
