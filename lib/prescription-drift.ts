/**
 * Compare une prescription extraite d'une ordonnance avec le médicament
 * correspondant déjà saisi dans `medications`. Sert à dire à l'utilisateur
 * si /medications reflète bien l'ordonnance ou s'il y a un drift.
 *
 * 4 états possibles :
 *  - `synced` : posologie + dosage identiques (normalisés) → ✓ vert
 *  - `drift` : nom matche mais détail diffère → ⚠ orange, action nécessaire
 *  - `stopped` : nom matche mais médoc en status=stopped → ⊘ gris
 *  - `missing` : pas de match → rien à comparer (l'UI propose Ajouter)
 */

import type { Medication } from "./medications-helpers";

export type PrescriptionDriftState =
  | "synced"
  | "drift"
  | "stopped"
  | "missing";

export interface PrescriptionLike {
  dosage?: string | null;
  posology: string;
  schedule?: { step_order: number }[];
}

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.,;:()\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens significatifs (≥3 chars, sans stopwords cliniques évidents). */
const POSOLOGY_STOPWORDS = new Set([
  "par", "pour", "puis", "ensuite", "avec", "sans", "mais", "etre", "ete",
  "the", "and", "des", "les", "une", "deux", "trois", "quatre",
]);

function posologyTokens(s: string | null | undefined): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length >= 3 && !POSOLOGY_STOPWORDS.has(t)),
  );
}

function tokensEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

/**
 * Compare une prescription extraite avec son médicament déjà saisi.
 * `match` peut être null si pas de correspondance trouvée par nom.
 */
export function comparePrescriptionWithMedication(
  prescription: PrescriptionLike,
  match: Medication | null,
): { state: PrescriptionDriftState; differences: string[] } {
  if (!match) return { state: "missing", differences: [] };
  if (match.status === "stopped" || match.status === "paused") {
    return { state: "stopped", differences: [] };
  }

  const differences: string[] = [];

  // Comparaison dosage : normalisé strict
  const presDose = normalize(prescription.dosage);
  const medDose = normalize(match.dosage);
  if (presDose && medDose && presDose !== medDose) {
    differences.push(`dosage (ordo : ${prescription.dosage} · saisi : ${match.dosage})`);
  } else if (presDose && !medDose) {
    differences.push(`dosage absent en base (ordo : ${prescription.dosage})`);
  }

  // Comparaison posologie : par tokens normalisés (l'ordre n'importe pas)
  const presPos = posologyTokens(prescription.posology);
  const medPos = posologyTokens(match.posology);
  if (presPos.size > 0 && medPos.size > 0 && !tokensEqual(presPos, medPos)) {
    differences.push("posologie");
  }

  return {
    state: differences.length === 0 ? "synced" : "drift",
    differences,
  };
}

export function summarizeStates(states: PrescriptionDriftState[]): {
  synced: number;
  drift: number;
  stopped: number;
  missing: number;
  total: number;
} {
  const r = { synced: 0, drift: 0, stopped: 0, missing: 0, total: states.length };
  for (const s of states) {
    if (s === "synced") r.synced++;
    else if (s === "drift") r.drift++;
    else if (s === "stopped") r.stopped++;
    else r.missing++;
  }
  return r;
}
