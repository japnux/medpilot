/**
 * Helpers pour les changements de dosage d'un médicament.
 *
 * Pattern : on enregistre l'historique dans `medication_dosage_changes`
 * (avant/après, date, raison, source) PUIS on met à jour la row
 * `medications` pour refléter la dose courante. Bonus : un timeline_event
 * type `treatment_adjustment` est créé pour rendre l'ajustement visible
 * chronologiquement.
 */

import type { Database } from "@/types/database";

export type DosageChangeRow =
  Database["public"]["Tables"]["medication_dosage_changes"]["Row"];

export interface DosageChangeInput {
  /** Nouvelle dose (ex: "20 mg") — obligatoire. */
  new_dosage: string;
  /** Nouvelle posologie (ex: "10 mg matin + 5 mg midi + 5 mg fin d'après-midi"). */
  new_posology?: string | null;
  /** Date du changement (YYYY-MM-DD), défaut aujourd'hui. */
  changed_at?: string;
  /** Raison clinique du changement. */
  reason?: string | null;
  /** Nom du prescripteur (datalist care_team côté UI). */
  prescriber?: string | null;
  /** Lien optionnel vers la consultation source. */
  source_consultation_id?: string | null;
  /** Lien optionnel vers le document source (ordonnance, courrier). */
  source_document_id?: string | null;
  /** Note libre. */
  notes?: string | null;
}

export function formatDosageDelta(
  previous: string | null,
  next: string,
): string {
  if (!previous || previous.trim() === "") return `→ ${next}`;
  if (previous === next) return next;
  return `${previous} → ${next}`;
}
