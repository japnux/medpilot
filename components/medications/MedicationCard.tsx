"use client";

import { useState } from "react";
import {
  Stethoscope,
  FileText,
  Calendar,
  Pencil,
  Trash2,
  Square,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import MedicationStatusBadge from "./MedicationStatusBadge";
import DosageHistory from "./DosageHistory";
import {
  formatDateFR,
  getRouteLabel,
  type Medication,
} from "@/lib/medications-helpers";
import type { DosageChangeRow } from "@/lib/medication-dosage-helpers";
import {
  daysRemainingInCurrentStep,
  getCurrentStep,
  getCurrentStepIndex,
  getNextStep,
  getScheduleStatus,
  todayIso,
  type ScheduleStep,
} from "@/lib/medication-schedule";

interface Props {
  medication: Medication;
  dosageChanges?: DosageChangeRow[];
  /** Paliers du plan posologique (vide si dose unique stable). */
  schedule?: ScheduleStep[];
  onEdit: (m: Medication) => void;
  onStop: (m: Medication) => void;
  onDelete: (m: Medication) => void;
  onChangeDosage?: (m: Medication) => void;
}

/**
 * Carte d'un médicament : identité, posologie, contexte clinique, dates, actions.
 * "Arrêter" est un raccourci vers l'édition pré-remplie (le form gère la date
 * de fin + raison).
 */
/** Liens officiels disponibles pour ce médicament, ordre fixe. */
function getLinks(m: Medication): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  if (m.wikipedia_url) links.push({ label: "Wikipedia", url: m.wikipedia_url });
  if (m.vidal_url) links.push({ label: "Vidal", url: m.vidal_url });
  if (m.ansm_url) links.push({ label: "ANSM", url: m.ansm_url });
  return links;
}

export default function MedicationCard({
  medication: m,
  dosageChanges = [],
  schedule = [],
  onEdit,
  onStop,
  onDelete,
  onChangeDosage,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const links = getLinks(m);

  const today = todayIso();
  const hasSchedule = schedule.length > 0;
  const scheduleStatus = hasSchedule ? getScheduleStatus(schedule, today) : "empty";
  const currentStep = hasSchedule ? getCurrentStep(schedule, today) : null;
  const nextStep = hasSchedule ? getNextStep(schedule, today) : null;
  const stepIdx = hasSchedule ? getCurrentStepIndex(schedule, today) : null;
  const daysLeft = hasSchedule ? daysRemainingInCurrentStep(schedule, today) : null;

  // Effectif affiché : palier courant si dispo, sinon posologie de la fiche.
  const displayDosage = currentStep?.dosage ?? m.dosage;
  const displayPosology = currentStep?.posology ?? m.posology;

  return (
    <div className="rounded-lg border border-hairline bg-canvas p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-base font-medium text-ink">{m.name}</h3>
            {m.brand_name && (
              <span className="text-sm text-muted">({m.brand_name})</span>
            )}
            {displayDosage && (
              <span className="text-sm text-muted">· {displayDosage}</span>
            )}
            {m.form && <span className="text-sm text-muted">· {m.form}</span>}
          </div>
          <p className="text-sm text-body mt-1.5">{displayPosology}</p>
          {m.route !== "oral" && (
            <p className="text-xs text-muted mt-1">
              Voie : {getRouteLabel(m.route)}
            </p>
          )}
        </div>
        <MedicationStatusBadge status={m.status} />
      </div>

      {/* Encart plan posologique structuré */}
      {hasSchedule && (
        <ScheduleBlock
          schedule={schedule}
          today={today}
          status={scheduleStatus}
          currentStep={currentStep}
          nextStep={nextStep}
          stepIdx={stepIdx}
          daysLeft={daysLeft}
          open={scheduleOpen}
          onToggle={() => setScheduleOpen((v) => !v)}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {m.indication && (
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {m.indication}
          </span>
        )}
        {m.prescriber && (
          <span className="inline-flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5" />
            {m.prescriber}
          </span>
        )}
        {m.started_at && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Depuis le {formatDateFR(m.started_at)}
          </span>
        )}
        {m.ended_at && m.status === "stopped" && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Arrêté le {formatDateFR(m.ended_at)}
          </span>
        )}
      </div>

      {m.status_reason && (
        <p className="mt-2 text-xs text-muted italic">
          Raison : {m.status_reason}
        </p>
      )}

      {m.notes && (
        <p className="mt-2 text-xs text-body whitespace-pre-line">{m.notes}</p>
      )}

      {/* Effets indésirables : section dépliable */}
      {m.known_side_effects && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setSideOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-body hover:text-ink"
            aria-expanded={sideOpen}
          >
            {sideOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
            Effets indésirables connus
          </button>
          {sideOpen && (
            <p className="mt-1.5 ml-5 text-xs text-body whitespace-pre-line">
              {m.known_side_effects}
            </p>
          )}
        </div>
      )}

      {/* Historique des doses (replié par défaut) */}
      {dosageChanges.length > 0 && (
        <DosageHistory changes={dosageChanges} />
      )}

      {/* Liens officiels */}
      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-card text-xs text-body hover:text-ink"
              title={`Voir ${l.label}`}
            >
              <ExternalLink className="w-3 h-3" />
              {l.label}
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(m)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-body hover:text-ink hover:bg-surface-card"
        >
          <Pencil className="w-3.5 h-3.5" />
          Éditer
        </button>
        {m.status === "active" && onChangeDosage && (
          <button
            type="button"
            onClick={() => onChangeDosage(m)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-body hover:text-ink hover:bg-surface-card"
            title="Enregistrer un changement de dose"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Modifier la dose
          </button>
        )}
        {m.status === "active" && (
          <button
            type="button"
            onClick={() => onStop(m)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-body hover:text-ink hover:bg-surface-card"
          >
            <Square className="w-3.5 h-3.5" />
            Arrêter
          </button>
        )}
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted hover:text-red-700 hover:bg-red-50 md:ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
        ) : (
          <div className="md:ml-auto inline-flex items-center gap-2 text-xs">
            <span className="text-muted">Confirmer ?</span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete(m);
              }}
              className="px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-2 py-1 rounded-md text-muted hover:text-ink"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ScheduleBlock — encart "Plan posologique" : palier courant en gros, timeline
// horizontale segmentée, plan complet repliable.
// ============================================================================

interface ScheduleBlockProps {
  schedule: ScheduleStep[];
  today: string;
  status: "before" | "current" | "after" | "empty";
  currentStep: ScheduleStep | null;
  nextStep: ScheduleStep | null;
  stepIdx: { index: number; total: number } | null;
  daysLeft: number | null;
  open: boolean;
  onToggle: () => void;
}

function ScheduleBlock({
  schedule,
  today,
  status,
  currentStep,
  nextStep,
  stepIdx,
  daysLeft,
  open,
  onToggle,
}: ScheduleBlockProps) {
  const sorted = [...schedule].sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="mt-3 rounded-md border border-fuchsia-200 bg-fuchsia-50/40 overflow-hidden">
      {/* En-tête : palier courant en gros */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-start gap-3 text-left hover:bg-fuchsia-50/70 transition-colors"
        aria-expanded={open}
      >
        <Calendar className="w-4 h-4 text-fuchsia-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {status === "current" && currentStep && stepIdx ? (
            <>
              <p className="text-xs uppercase tracking-wider text-fuchsia-700 font-medium">
                Palier {stepIdx.index}/{stepIdx.total} en cours
              </p>
              <p className="text-sm text-ink font-medium mt-0.5">
                {currentStep.dosage ?? currentStep.posology}
              </p>
              <p className="text-xs text-body mt-0.5">
                {currentStep.end_date
                  ? `Jusqu'au ${formatDateFR(currentStep.end_date)}${daysLeft != null ? ` · ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}` : ""}`
                  : "Palier de maintenance"}
              </p>
              {nextStep && (
                <p className="text-xs text-fuchsia-700 mt-1">
                  ⏭️ Puis {nextStep.dosage ?? nextStep.posology} dès le{" "}
                  {formatDateFR(nextStep.start_date)}
                </p>
              )}
            </>
          ) : status === "before" ? (
            <>
              <p className="text-xs uppercase tracking-wider text-fuchsia-700 font-medium">
                Plan posologique à venir
              </p>
              <p className="text-sm text-ink mt-0.5">
                Démarre le {formatDateFR(sorted[0].start_date)} ·{" "}
                {sorted.length} palier{sorted.length > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wider text-muted font-medium">
                Plan posologique terminé
              </p>
              <p className="text-sm text-body mt-0.5">
                {sorted.length} palier{sorted.length > 1 ? "s" : ""} — fin le{" "}
                {sorted[sorted.length - 1].end_date
                  ? formatDateFR(sorted[sorted.length - 1].end_date!)
                  : "?"}
              </p>
            </>
          )}
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted shrink-0 mt-1" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted shrink-0 mt-1" />
        )}
      </button>

      {/* Timeline visuelle segmentée */}
      <ScheduleTimeline schedule={sorted} today={today} />

      {/* Plan complet déplié */}
      {open && (
        <ol className="px-3 pb-3 space-y-1.5 border-t border-fuchsia-200/50 pt-2.5">
          {sorted.map((step) => {
            const isCurrent = currentStep?.step_order === step.step_order;
            const isPast =
              step.end_date != null && step.end_date < today;
            return (
              <li
                key={step.step_order}
                className={`text-xs flex items-start gap-2.5 ${
                  isCurrent ? "" : isPast ? "opacity-50" : ""
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium shrink-0 mt-0.5 ${
                    isCurrent
                      ? "bg-fuchsia-600 text-white"
                      : isPast
                        ? "bg-gray-200 text-gray-500"
                        : "bg-fuchsia-100 text-fuchsia-700"
                  }`}
                >
                  {step.step_order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-ink">
                      {step.dosage ?? step.posology}
                    </span>
                    <span className="text-muted">
                      {formatDateFR(step.start_date)}
                      {step.end_date
                        ? ` → ${formatDateFR(step.end_date)}`
                        : " (maintenance)"}
                    </span>
                  </div>
                  {step.dosage && (
                    <p className="text-muted mt-0.5">{step.posology}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Barre horizontale segmentée : un segment par palier, largeur ∝ durée.
 * Palier passé = gris, palier courant = fuchsia plein, futur = fuchsia clair.
 * Un curseur vertical marque la position de today à l'intérieur du palier
 * courant.
 */
function ScheduleTimeline({
  schedule,
  today,
}: {
  schedule: ScheduleStep[];
  today: string;
}) {
  if (schedule.length === 0) return null;

  const start = new Date(schedule[0].start_date + "T00:00:00").getTime();
  // End du dernier palier ; si maintenance, on prend +30j pour donner une largeur visible
  const lastEnd = schedule[schedule.length - 1].end_date;
  const end = lastEnd
    ? new Date(lastEnd + "T00:00:00").getTime()
    : new Date(schedule[schedule.length - 1].start_date + "T00:00:00").getTime() +
      30 * 86_400_000;
  const total = Math.max(end - start, 1);
  const todayMs = new Date(today + "T00:00:00").getTime();
  const todayPct =
    todayMs <= start
      ? 0
      : todayMs >= end
        ? 100
        : ((todayMs - start) / total) * 100;

  return (
    <div className="relative px-3 pb-2 pt-1">
      <div className="relative flex h-2 rounded-full overflow-hidden bg-fuchsia-100">
        {schedule.map((step) => {
          const sStart = new Date(step.start_date + "T00:00:00").getTime();
          const sEnd = step.end_date
            ? new Date(step.end_date + "T00:00:00").getTime()
            : end;
          const widthPct = ((sEnd - sStart) / total) * 100;
          const isPast = step.end_date != null && step.end_date < today;
          const isCurrent =
            step.start_date <= today &&
            (step.end_date == null || step.end_date >= today);
          return (
            <div
              key={step.step_order}
              style={{ width: `${widthPct}%` }}
              className={`h-full border-r border-canvas/40 last:border-r-0 ${
                isCurrent
                  ? "bg-fuchsia-600"
                  : isPast
                    ? "bg-fuchsia-300"
                    : "bg-fuchsia-100"
              }`}
              title={`Palier ${step.step_order} — ${formatDateFR(step.start_date)}${step.end_date ? ` → ${formatDateFR(step.end_date)}` : ""}`}
            />
          );
        })}
      </div>
      {todayMs >= start && todayMs <= end && (
        <div
          className="absolute top-0 bottom-0 w-px bg-ink/80 pointer-events-none"
          style={{
            left: `calc(0.75rem + ${todayPct}% * (100% - 1.5rem) / 100%)`,
          }}
        >
          <span className="absolute -top-1 -left-[3px] w-1.5 h-1.5 rounded-full bg-ink" />
        </div>
      )}
    </div>
  );
}
