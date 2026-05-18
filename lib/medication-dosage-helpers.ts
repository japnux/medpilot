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

/**
 * Normalise une chaîne dose/posologie pour comparaison sémantique :
 * - trim
 * - collapse des espaces internes multiples en un seul (un saut de ligne suffit
 *   pour qu'un copier-coller d'ordonnance soit jugé "différent" sinon)
 *
 * On garde la casse car certaines posologies l'utilisent (ex: "BID", "PRN")
 * et un médecin pourrait délibérément la modifier.
 */
function normalizeDose(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Détecte un changement de DOSE réel (après normalisation des espaces).
 * Retourne true uniquement si le `dosage` change. Une modification de la seule
 * `posology` (texte plus détaillé, mention « 2 boîtes », etc.) ne déclenche
 * PAS d'entrée historique : conceptuellement, l'« Historique des doses » ne
 * journalise que les vrais ajustements de dose, pas les reformulations.
 *
 * Utilisé à la fois côté UI (DosageChangeModal pour le warning immédiat) et
 * côté serveur (POST /api/medications/[id]/dosage-change comme filet de
 * sécurité) pour éviter d'écrire des entrées « 1 g → 1 g » dans l'historique
 * quand l'utilisateur valide une ordonnance qui ne change pas la dose.
 */
export function isRealDosageChange(args: {
  previousDosage: string | null;
  newDosage: string | null;
}): boolean {
  const prevD = normalizeDose(args.previousDosage);
  const nextD = normalizeDose(args.newDosage);
  return nextD !== "" && nextD !== prevD;
}

/**
 * Détecte un changement de posologie réel (texte libre, après normalisation).
 * Sert à décider si on doit mettre à jour la row courante même quand la dose
 * n'a pas bougé (et donc qu'on ne crée pas d'entrée historique).
 */
export function isRealPosologyChange(args: {
  previousPosology: string | null;
  newPosology: string | null;
}): boolean {
  const prev = normalizeDose(args.previousPosology);
  const next = normalizeDose(args.newPosology);
  return next !== "" && next !== prev;
}
