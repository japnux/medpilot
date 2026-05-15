"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formatDateFr } from "@/lib/dates";
import {
  Calendar,
  Clock,
  FileText,
  Stethoscope,
  CheckCircle,
} from "lucide-react";

interface Consultation {
  id: string;
  consultation_date: string;
  doctor_name: string | null;
  consultation_type: string | null;
  hospital: string | null;
  status: string;
  decisions_made?: unknown;
}

interface Document {
  id: string;
  title: string;
  document_type: string;
  document_date: string | null;
  created_at: string;
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
  upcomingConsults: Consultation[];
  pastConsults: Consultation[];
  documents: Document[];
  surveillance: SurveillanceSlot[];
}

/**
 * Timeline simplifiée : 3 sections séparées
 *  1. Prochains RDV (consultations à venir + surveillance planifiée)
 *  2. Documents (tous les comptes-rendus analysés)
 *  3. RDV passés (consultations terminées)
 */
export default function TimelineClient({
  upcomingConsults,
  pastConsults,
  documents,
  surveillance,
  familyId,
}: Props) {
  const router = useRouter();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Timeline du parcours</h1>
        <p className="text-sm text-slate-400 mt-1">
          Vue d&apos;ensemble : prochains rendez-vous, documents médicaux et historique.
        </p>
      </header>

      {/* ====== Prochains RDV ====== */}
      <section className="space-y-3">
        <SectionHeader
          title="Prochains rendez-vous"
          count={upcomingConsults.length + surveillance.length}
        />
        {upcomingConsults.length + surveillance.length === 0 ? (
          <EmptyCard text="Aucun rendez-vous planifié." />
        ) : (
          <ul className="space-y-2">
            {upcomingConsults.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/consultation/${c.id}`}
                  className="block rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 p-4 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">
                          {formatDateFr(c.consultation_date)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {daysUntil(c.consultation_date)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.consultation_type ?? "Consultation"}
                        {c.doctor_name && ` · ${c.doctor_name}`}
                        {c.hospital && ` · ${c.hospital}`}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {surveillance.map((s) => (
              <SurveillanceCard
                key={s.id}
                slot={s}
                familyId={familyId}
                onUpdate={() => router.refresh()}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ====== Documents ====== */}
      <section className="space-y-3">
        <SectionHeader title="Documents médicaux" count={documents.length} />
        {documents.length === 0 ? (
          <EmptyCard text="Aucun document analysé pour le moment. Allez dans « Analyser »." />
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/documents/${d.id}`}
                  className="block rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">
                          {formatDateFr(d.document_date ?? d.created_at)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {d.document_type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 mt-0.5 truncate">{d.title}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ====== RDV passés ====== */}
      <section className="space-y-3">
        <SectionHeader title="Rendez-vous passés" count={pastConsults.length} />
        {pastConsults.length === 0 ? (
          <EmptyCard text="Aucune consultation passée enregistrée." />
        ) : (
          <ul className="space-y-2">
            {pastConsults.map((c) => {
              const decisions = Array.isArray(c.decisions_made)
                ? (c.decisions_made as string[])
                : null;
              return (
                <li key={c.id}>
                  <Link
                    href={`/consultation/${c.id}`}
                    className="block rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 p-4 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {c.status === "completed" ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Stethoscope className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {formatDateFr(c.consultation_date)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {c.consultation_type ?? "Consultation"}
                            {c.doctor_name && ` · ${c.doctor_name}`}
                          </span>
                          {c.status !== "completed" && (
                            <span className="text-[10px] text-amber-400 italic">
                              non renseignée
                            </span>
                          )}
                        </div>
                        {decisions && decisions.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {decisions.join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-slate-800 pb-2">
      <h2 className="text-base font-medium text-white">{title}</h2>
      <span className="text-xs text-slate-500">
        {count} {count > 1 ? "éléments" : "élément"}
      </span>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/20 p-6 text-center">
      <p className="text-xs text-slate-500 italic">{text}</p>
    </div>
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
    <li className="rounded-lg border border-dashed border-slate-800 bg-slate-950/20 p-4">
      <div className="flex items-start gap-3">
        <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">
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
            <span className="text-xs text-slate-500">à planifier</span>
          </div>
          <p className="text-sm text-slate-300 mt-0.5">{slot.label}</p>
        </div>
        <button
          onClick={markDone}
          className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded border border-emerald-700/40 shrink-0"
        >
          Fait
        </button>
      </div>
    </li>
  );
}

function daysUntil(dateIso: string): string {
  const days = Math.ceil(
    (new Date(dateIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days < 0) return `il y a ${Math.abs(days)} j`;
  return `dans ${days} j`;
}
