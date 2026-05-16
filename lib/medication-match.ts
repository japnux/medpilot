/**
 * Helper de fuzzy match entre une prescription extraite d'une ordonnance
 * et les médicaments déjà saisis dans `medications`.
 *
 * Stratégie :
 *  - Normalisation : lowercase, sans accents, sans ponctuation.
 *  - Match sur `name` OU `brand_name` OU `active_ingredient` :
 *    si l'un est inclus dans l'autre après normalisation (par tokens),
 *    c'est le même médicament. Couvre :
 *      - "Sertraline" (prescription) ≡ "Zoloft" (existant avec
 *        active_ingredient="Sertraline")
 *      - "Hydrocortisone" ≡ "Hydrocortisone Upjohn"
 *      - "Doliprane 1g" ≡ "Paracétamol 1000mg"
 */

export interface MedMatchableFields {
  name?: string | null;
  brand_name?: string | null;
  active_ingredient?: string | null;
}

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.,;:()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string | null | undefined): Set<string> {
  const n = normalize(s);
  if (!n) return new Set();
  return new Set(n.split(" ").filter((t) => t.length >= 3));
}

/**
 * Retourne true si les deux médicaments référencent vraisemblablement la
 * même molécule. Compare tous les champs disponibles en fuzzy.
 */
export function isSameMedication(
  a: MedMatchableFields,
  b: MedMatchableFields,
): boolean {
  const aTokens = [
    tokens(a.name),
    tokens(a.brand_name),
    tokens(a.active_ingredient),
  ].filter((s) => s.size > 0);
  const bTokens = [
    tokens(b.name),
    tokens(b.brand_name),
    tokens(b.active_ingredient),
  ].filter((s) => s.size > 0);

  for (const at of aTokens) {
    for (const bt of bTokens) {
      // Match si l'un est inclus dans l'autre (tous les tokens du plus petit
      // sont dans le plus grand).
      const aInB = [...at].every((t) => bt.has(t));
      const bInA = [...bt].every((t) => at.has(t));
      if (aInB || bInA) return true;
    }
  }
  return false;
}

/**
 * Trouve le médicament existant qui matche la prescription, le cas échéant.
 */
export function findMatchingMedication<
  T extends MedMatchableFields & { id: string; status?: string },
>(prescription: MedMatchableFields, existing: T[]): T | null {
  // Priorité aux actifs si on a plusieurs matches
  const matches = existing.filter((m) => isSameMedication(prescription, m));
  if (matches.length === 0) return null;
  const active = matches.find((m) => m.status === "active");
  return active ?? matches[0];
}
