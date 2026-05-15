"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formatDateFr } from "@/lib/dates";
import { EVENT_TYPES, getEventMeta } from "@/lib/timeline-events";
import type { EventType } from "@/types/database";
import { Clock, AlertCircle } from "lucide-react";

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

interface SurveillanceSlot {
  id: string;
  alert_type: string;
  label: string;
  due_date: string;
  is_done: boolean | null;
}

interface Props {
  familyId: string;
  events: TimelineEvent[];
  surveillance: SurveillanceSlot[];
}

/**
 * Timeline unifiée : axe chronologique vertical, du plus récent au plus ancien.
 * - En tête : les 5 prochaines surveillances planifiées
 * - Puis : tous les événements (chirurgie, consultations, documents, biologie)
 *   avec dots colorés par type et clic vers la fiche détail.
 */
export default function TimelineClient({
  familyId,
  events,
  surveillance,
}: Props) {
  const router = useRouter();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Timeline du parcours</h1>
        <p className="text-sm text-muted mt-1">
          Tous les événements médicaux, du plus récent au plus ancien.
        </p>
      </header>

      {/* ====== Prochaines surveillances ====== */}
      {surveillance.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-ink">
            Prochaines surveillances
          </h2>
          <ul className="space-y-2">
            {surveillance.map((s) => (
              <SurveillanceCard
                key={s.id}
                slot={s}
                familyId={familyId}
                onUpdate={() => router.refresh()}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ====== Timeline chronologique ====== */}
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
        className="absolute -left-8 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: meta.color, backgroundColor: "#0d1520" }}
      >
        <Icon className="w-3 h-3" style={{ color: meta.color }} />
      </div>
      {href ? <Link href={href}>{card}</Link> : card}
    </article>
  );
}

function SurveillanceCard({
  slot,
  familyId,
  onUpdate,
}: {
  slot: SurveillanceSlot;
  familyId: string;
  onUpdate: () => void;
}) {
  const dueIn = Math.ceil(
    (new Date(slot.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const overdue = dueIn < 0;
  const soon = dueIn >= 0 && dueIn <= 14;
  const color = overdue ? "#ef4444" : soon ? "#f59e0b" : "#64748b";

  async function markDone() {
    const supabase = createClient();
    await supabase
      .from("surveillance_alerts")
      .update({ is_done: true })
      .eq("id", slot.id);
    await supabase.from("timeline_events").insert({
      family_id: familyId,
      event_type: "other",
      event_date: new Date().toISOString().slice(0, 10),
      title: slot.label,
      summary: "Surveillance planifiée — réalisée",
    });
    onUpdate();
  }

  return (
    <li className="rounded-lg border border-dashed border-hairline bg-canvas-soft p-4">
      <div className="flex items-start gap-3">
        <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-body-strong">
              {formatDateFr(slot.due_date)}
            </span>
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color,
                backgroundColor: `${color}1a`,
                border: `1px solid ${color}40`,
              }}
            >
              {overdue
                ? `En retard ${Math.abs(dueIn)}j`
                : soon
                  ? `Dans ${dueIn}j`
                  : `Dans ${dueIn}j`}
            </span>
            <span className="text-xs text-muted">à planifier</span>
          </div>
          <p className="text-sm text-body mt-0.5">{slot.label}</p>
        </div>
        <button
          onClick={markDone}
          className="text-xs text-success hover:text-success px-2 py-1 rounded border border-success/30 shrink-0"
        >
          Fait
        </button>
      </div>
    </li>
  );
}
