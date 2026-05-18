"use client";

import Link from "next/link";
import { formatDateFr } from "@/lib/dates";
import { getEventMeta } from "@/lib/timeline-events";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Pill,
  Thermometer,
} from "lucide-react";

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

interface DecisionCount {
  total: number;
  pending: number;
  decided: number;
}

export interface DecisionCountMap {
  documents: Record<string, DecisionCount>;
  consultations: Record<string, DecisionCount>;
}

export interface CrossModuleCountMap {
  /** Indexé par event_date (YYYY-MM-DD). */
  [eventDate: string]: {
    medications: number;
    symptoms: number;
  };
}

interface Props {
  familyId: string;
  events: TimelineEvent[];
  decisionCounts: DecisionCountMap;
  crossCounts: CrossModuleCountMap;
}

/**
 * Timeline en 3 sections temporelles : À venir / Aujourd'hui / Historique.
 * Cartes enrichies de badges cross-modules (décisions, médicaments
 * prescrits ce jour, symptômes signalés à ±3j) avec une grammaire
 * unifiée.
 */
export default function TimelineClient({
  events,
  decisionCounts,
  crossCounts,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const future: TimelineEvent[] = [];
  const todayEvents: TimelineEvent[] = [];
  const past: TimelineEvent[] = [];
  for (const e of events) {
    if (e.event_date > today) future.push(e);
    else if (e.event_date === today) todayEvents.push(e);
    else past.push(e);
  }
  // Future events : chronologique ascendant (du plus proche au plus lointain)
  future.reverse();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 pr-12 md:pr-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Timeline du parcours</h1>
        <p className="text-sm text-muted mt-1">
          Vue chronologique : ce qui arrive, ce qui se passe aujourd&apos;hui,
          ce qui s&apos;est passé.
        </p>
      </header>

      {future.length > 0 && (
        <Section
          title="À venir"
          icon={<CalendarClock className="w-4 h-4 text-blue-600" />}
          count={future.length}
          tone="future"
        >
          {future.map((e) => (
            <EventItem
              key={e.id}
              event={e}
              decisionCount={pickDecisionCount(e, decisionCounts)}
              crossCount={crossCounts[e.event_date]}
              tone="future"
            />
          ))}
        </Section>
      )}

      {todayEvents.length > 0 && (
        <Section
          title="Aujourd'hui"
          icon={
            <span className="inline-block w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
          }
          count={todayEvents.length}
          tone="today"
        >
          {todayEvents.map((e) => (
            <EventItem
              key={e.id}
              event={e}
              decisionCount={pickDecisionCount(e, decisionCounts)}
              crossCount={crossCounts[e.event_date]}
              tone="today"
            />
          ))}
        </Section>
      )}

      <Section
        title="Historique"
        icon={null}
        count={past.length}
        tone="past"
      >
        {past.length === 0 ? (
          <p className="text-xs text-muted italic py-6 text-center">
            Aucun événement passé enregistré.
          </p>
        ) : (
          past.map((e) => (
            <EventItem
              key={e.id}
              event={e}
              decisionCount={pickDecisionCount(e, decisionCounts)}
              crossCount={crossCounts[e.event_date]}
              tone="past"
            />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  count,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  tone: "future" | "today" | "past";
  children: React.ReactNode;
}) {
  const headerClass =
    tone === "future"
      ? "border-blue-500/30"
      : tone === "today"
        ? "border-purple-500/30"
        : "border-hairline";

  return (
    <section className="space-y-3">
      <header
        className={`flex items-center gap-2 pb-2 border-b ${headerClass}`}
      >
        {icon}
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {count > 0 && (
          <span className="text-[10px] text-muted">({count})</span>
        )}
      </header>
      <div className="relative pl-8 space-y-4">
        <div className="absolute left-3 top-2 bottom-2 w-px bg-surface-strong" />
        {children}
      </div>
    </section>
  );
}

function pickDecisionCount(
  e: TimelineEvent,
  map: DecisionCountMap,
): DecisionCount | null {
  if (e.linked_document_id && map.documents[e.linked_document_id]) {
    return map.documents[e.linked_document_id];
  }
  if (e.linked_consultation_id && map.consultations[e.linked_consultation_id]) {
    return map.consultations[e.linked_consultation_id];
  }
  return null;
}

function EventItem({
  event,
  decisionCount,
  crossCount,
  tone,
}: {
  event: TimelineEvent;
  decisionCount: DecisionCount | null;
  crossCount: { medications: number; symptoms: number } | undefined;
  tone: "future" | "today" | "past";
}) {
  const meta = getEventMeta(event.event_type);
  const Icon = meta.icon;

  const href = event.linked_document_id
    ? `/documents/${event.linked_document_id}`
    : event.linked_consultation_id
      ? `/consultation/${event.linked_consultation_id}`
      : null;

  const cardBg =
    tone === "future"
      ? "bg-blue-500/5 border-blue-500/30"
      : tone === "today"
        ? "bg-purple-500/5 border-purple-500/30"
        : event.is_critical
          ? "bg-canvas-soft border-error/30"
          : "bg-surface-card border-hairline";

  const card = (
    <div
      className={`rounded-lg border p-3 transition-colors ${cardBg} ${href ? "hover:bg-surface-strong" : ""}`}
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
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/30">
            <AlertCircle className="w-3 h-3" />
            Résultat critique
          </span>
        )}
        <DecisionsBadge count={decisionCount} />
        {crossCount?.medications && crossCount.medications > 0 ? (
          <CrossBadge
            icon={<Pill className="w-3 h-3" />}
            label={`${crossCount.medications} médicament${crossCount.medications > 1 ? "s" : ""}`}
            tone="indigo"
            title={`${crossCount.medications} médicament${crossCount.medications > 1 ? "s" : ""} démarré${crossCount.medications > 1 ? "s" : ""} ce jour`}
          />
        ) : null}
        {crossCount?.symptoms && crossCount.symptoms > 0 ? (
          <CrossBadge
            icon={<Thermometer className="w-3 h-3" />}
            label={`${crossCount.symptoms} symptôme${crossCount.symptoms > 1 ? "s" : ""}`}
            tone="amber"
            title={`${crossCount.symptoms} symptôme(s) signalé(s) à ±3j de cet événement`}
          />
        ) : null}
      </div>
      <h3 className="text-sm font-medium text-ink">{event.title}</h3>
    </div>
  );

  return (
    <article className="relative">
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

/**
 * Badge décisions avec grammaire unifiée :
 *  - Toutes pending → "3 décisions ouvertes" (orange)
 *  - Mix pending + décidées → "2/3 tranchées" (indigo)
 *  - Toutes tranchées → "✓ 3 décisions tranchées" (vert)
 *  - Sinon (toutes caduques/abandonnées) → pas de badge
 */
function DecisionsBadge({ count }: { count: DecisionCount | null }) {
  if (!count || count.total === 0) return null;
  const { total, pending, decided } = count;

  // Cas 1 : toutes pending
  if (pending === total) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30"
        title={`${total} décision(s) ouverte(s)`}
      >
        <GitBranch className="w-3 h-3" />
        {total} ouverte{total > 1 ? "s" : ""}
      </span>
    );
  }
  // Cas 2 : toutes tranchées
  if (decided === total) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30"
        title={`${total} décision(s) tranchée(s)`}
      >
        <CheckCircle2 className="w-3 h-3" />
        {total} tranchée{total > 1 ? "s" : ""}
      </span>
    );
  }
  // Cas 3 : mix (décidées partiellement, ou inclut des caduques)
  if (decided > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 border border-indigo-500/30"
        title={`${decided} décision(s) tranchée(s) sur ${total}`}
      >
        <GitBranch className="w-3 h-3" />
        {decided}/{total} tranchées
      </span>
    );
  }
  // Cas 4 : pending + caduques (pas de décidée) → on traite comme "ouvertes en partie"
  if (pending > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30"
        title={`${pending} décision(s) ouverte(s) sur ${total}`}
      >
        <GitBranch className="w-3 h-3" />
        {pending} ouverte{pending > 1 ? "s" : ""}
      </span>
    );
  }
  return null;
}

function CrossBadge({
  icon,
  label,
  tone,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "indigo" | "amber";
  title?: string;
}) {
  const className =
    tone === "indigo"
      ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
      : "bg-amber-500/10 text-amber-700 border-amber-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${className}`}
      title={title}
    >
      {icon}
      {label}
    </span>
  );
}

// Pour éviter un warning d'export non utilisé si le composant est isolé
void ChevronRight;
