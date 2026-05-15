"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { EVENT_TYPES, getEventMeta } from "@/lib/timeline-events";
import type { EventType } from "@/types/database";
import { formatDateFr, today } from "@/lib/dates";
import { Plus, Filter, AlertCircle, Clock } from "lucide-react";

interface TimelineEvent {
  id: string;
  event_type: string;
  event_date: string;
  title: string;
  summary: string | null;
  is_critical: boolean | null;
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

const ALL_TYPES = Object.keys(EVENT_TYPES) as EventType[];

export default function TimelineClient({
  familyId,
  events: initialEvents,
  surveillance,
}: Props) {
  const router = useRouter();
  const [events] = useState(initialEvents);
  const [selectedTypes, setSelectedTypes] = useState<Set<EventType>>(
    new Set(ALL_TYPES),
  );
  const [period, setPeriod] = useState<"6m" | "1y" | "all">("1y");
  const [showAddModal, setShowAddModal] = useState(false);

  // Filtrage
  const now = new Date();
  const cutoff = new Date(now);
  if (period === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
  else if (period === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  else cutoff.setFullYear(1900);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const filteredEvents = events.filter(
    (e) =>
      selectedTypes.has(e.event_type as EventType) && e.event_date >= cutoffStr,
  );

  function toggleType(t: EventType) {
    const next = new Set(selectedTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setSelectedTypes(next);
  }

  // Fusionner timeline events et surveillance slots, triés par date desc
  const allItems = [
    ...filteredEvents.map((e) => ({ kind: "event" as const, ...e })),
    ...surveillance
      .filter((s) => !s.is_done)
      .map((s) => ({
        kind: "surveillance" as const,
        ...s,
        event_date: s.due_date,
      })),
  ].sort((a, b) => b.event_date.localeCompare(a.event_date));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white">Timeline du parcours</h1>
          <p className="text-sm text-slate-400 mt-1">
            {filteredEvents.length} événement{filteredEvents.length > 1 ? "s" : ""} ·{" "}
            {surveillance.filter((s) => !s.is_done).length} à planifier
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </header>

      {/* Filtres */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span>Période :</span>
          {(["6m", "1y", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 rounded ${
                period === p ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white"
              }`}
            >
              {p === "6m" ? "6 mois" : p === "1y" ? "1 an" : "Tout"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map((t) => {
            const meta = EVENT_TYPES[t];
            const on = selectedTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-colors"
                style={{
                  borderColor: on ? meta.color : "#334155",
                  backgroundColor: on ? `${meta.color}1a` : "transparent",
                  color: on ? meta.color : "#64748b",
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-8 space-y-4">
        {/* Ligne verticale */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-800"></div>

        {allItems.length === 0 && (
          <div className="text-center text-sm text-slate-500 italic py-12">
            Aucun événement ne correspond aux filtres.
          </div>
        )}

        {allItems.map((item) => {
          if (item.kind === "surveillance") {
            return (
              <SurveillanceItem
                key={`surv-${item.id}`}
                slot={item}
                familyId={familyId}
                onUpdate={() => router.refresh()}
              />
            );
          }
          return <EventItem key={item.id} event={item} />;
        })}
      </div>

      {showAddModal && (
        <AddManualEventModal
          familyId={familyId}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EventItem({ event }: { event: TimelineEvent }) {
  const meta = getEventMeta(event.event_type);
  const Icon = meta.icon;
  return (
    <article className="relative">
      <div
        className="absolute -left-8 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: meta.color, backgroundColor: "#0d1520" }}
      >
        <Icon className="w-3 h-3" style={{ color: meta.color }} />
      </div>
      <div className={`rounded-lg border p-3 ${
        event.is_critical
          ? "border-red-700/40 bg-red-900/10"
          : "border-slate-800 bg-slate-900/40"
      }`}>
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <span className="text-xs text-slate-500">{formatDateFr(event.event_date)}</span>
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
            <span className="flex items-center gap-1 text-[10px] text-red-300">
              <AlertCircle className="w-3 h-3" />
              Critique
            </span>
          )}
        </div>
        <h3 className="text-sm font-medium text-white">{event.title}</h3>
        {event.summary && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-3">{event.summary}</p>
        )}
      </div>
    </article>
  );
}

function SurveillanceItem({
  slot,
  familyId,
  onUpdate,
}: {
  slot: SurveillanceSlot & { event_date: string };
  familyId: string;
  onUpdate: () => void;
}) {
  const dueIn = Math.ceil(
    (new Date(slot.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const overdue = dueIn < 0;
  const soon = dueIn >= 0 && dueIn <= 14;

  const badgeColor = overdue ? "#ef4444" : soon ? "#f59e0b" : "#64748b";
  const badgeText = overdue
    ? `En retard de ${Math.abs(dueIn)}j`
    : soon
      ? `Dans ${dueIn}j`
      : `Dans ${dueIn}j`;

  async function markDone() {
    const supabase = createClient();
    await supabase
      .from("surveillance_alerts")
      .update({ is_done: true })
      .eq("id", slot.id);
    // Ajouter un événement timeline correspondant
    await supabase.from("timeline_events").insert({
      family_id: familyId,
      event_type: "other",
      event_date: today(),
      title: slot.label,
      summary: "Surveillance planifiée — réalisée",
    });
    onUpdate();
  }

  return (
    <article className="relative">
      <div
        className="absolute -left-8 top-1.5 w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center"
        style={{ borderColor: badgeColor, backgroundColor: "#0d1520" }}
      >
        <Clock className="w-3 h-3" style={{ color: badgeColor }} />
      </div>
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-3">
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <span className="text-xs text-slate-500">{formatDateFr(slot.due_date)}</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px]"
            style={{
              color: badgeColor,
              backgroundColor: `${badgeColor}1a`,
              border: `1px solid ${badgeColor}40`,
            }}
          >
            À planifier · {badgeText}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-slate-200">{slot.label}</h3>
          <button
            onClick={markDone}
            className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded border border-emerald-700/40"
          >
            Marquer comme fait
          </button>
        </div>
      </div>
    </article>
  );
}

function AddManualEventModal({
  familyId,
  onClose,
  onSaved,
}: {
  familyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(today());
  const [type, setType] = useState<EventType>("other");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Titre requis");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: e } = await supabase.from("timeline_events").insert({
        family_id: familyId,
        event_type: type,
        event_date: date,
        title,
        summary: summary || null,
      });
      if (e) throw e;
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h2 className="text-base font-medium text-white">Ajouter un événement</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 px-2 rounded bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventType)}
            className="h-9 px-2 rounded bg-slate-950 border border-slate-700 text-sm text-white"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPES[t].label}
              </option>
            ))}
          </select>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full h-9 px-2 rounded bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Résumé (optionnel)"
          rows={3}
          className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-sm text-white"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-lg border border-slate-700 text-sm text-slate-300"
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm text-white"
          >
            {saving ? "..." : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
