/**
 * Helpers pour le plan posologique structuré (medication_schedule_steps).
 *
 * Cas d'usage : schéma dégressif (corticoïdes), traitement à durée limitée,
 * alternance. Le palier "en cours" est calculé à la volée selon today.
 */

import type { Database } from "@/types/database";

export type ScheduleStep =
  Database["public"]["Tables"]["medication_schedule_steps"]["Row"];

/** Step partiel utilisé lors de la création (depuis une prescription extraite). */
export interface ScheduleStepInput {
  step_order: number;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  dosage: string | null;
  posology: string;
  notes?: string | null;
}

/** Renvoie le palier en cours à la date `today` (YYYY-MM-DD). */
export function getCurrentStep<T extends ScheduleStepShape>(
  steps: T[],
  today: string,
): T | null {
  if (!steps || steps.length === 0) return null;
  const sorted = sortByOrder(steps);
  for (const s of sorted) {
    if (s.start_date > today) continue;
    if (s.end_date == null) return s; // maintenance
    if (s.end_date >= today) return s;
  }
  return null;
}

/** Renvoie le prochain palier (start_date > today). */
export function getNextStep<T extends ScheduleStepShape>(
  steps: T[],
  today: string,
): T | null {
  if (!steps || steps.length === 0) return null;
  const upcoming = sortByOrder(steps).filter((s) => s.start_date > today);
  return upcoming[0] ?? null;
}

/** Index du palier en cours (1-based) ou null. */
export function getCurrentStepIndex<T extends ScheduleStepShape>(
  steps: T[],
  today: string,
): { index: number; total: number } | null {
  if (!steps || steps.length === 0) return null;
  const sorted = sortByOrder(steps);
  const current = getCurrentStep(sorted, today);
  if (!current) return null;
  const idx = sorted.findIndex((s) => s.step_order === current.step_order);
  return { index: idx + 1, total: sorted.length };
}

/**
 * Renvoie le statut temporel du palier en cours :
 *  - "before"  : commence à une date future (aucun palier actif)
 *  - "current" : un palier est en cours
 *  - "after"   : tous les paliers sont passés (fin du traitement)
 */
export function getScheduleStatus<T extends ScheduleStepShape>(
  steps: T[],
  today: string,
): "before" | "current" | "after" | "empty" {
  if (!steps || steps.length === 0) return "empty";
  const sorted = sortByOrder(steps);
  if (sorted[0].start_date > today) return "before";
  if (getCurrentStep(sorted, today)) return "current";
  return "after";
}

/** Nombre de jours restants sur le palier en cours, ou null. */
export function daysRemainingInCurrentStep<T extends ScheduleStepShape>(
  steps: T[],
  today: string,
): number | null {
  const current = getCurrentStep(steps, today);
  if (!current || !current.end_date) return null;
  const t = new Date(today + "T00:00:00").getTime();
  const e = new Date(current.end_date + "T00:00:00").getTime();
  return Math.max(0, Math.round((e - t) / 86_400_000));
}

/** Dates encadrantes du plan complet (debut du 1er, fin du dernier ou null). */
export function getScheduleBounds<T extends ScheduleStepShape>(
  steps: T[],
): { start: string | null; end: string | null } {
  if (!steps || steps.length === 0) return { start: null, end: null };
  const sorted = sortByOrder(steps);
  const start = sorted[0].start_date;
  const end = sorted[sorted.length - 1].end_date ?? null;
  return { start, end };
}

/** Date du jour au format YYYY-MM-DD (TZ système). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ScheduleStepShape {
  step_order: number;
  start_date: string;
  end_date: string | null;
}

function sortByOrder<T extends ScheduleStepShape>(steps: T[]): T[] {
  return [...steps].sort((a, b) => a.step_order - b.step_order);
}
