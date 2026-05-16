/**
 * Détection de red flags : un symptôme nouvellement inséré est flaggé
 * critique SI ET SEULEMENT SI :
 *   - Il contribue lui-même à un red flag (au moins 1 token clinique matché)
 *   - Combiné aux autres symptômes des 48h récentes, le red flag atteint
 *     son seuil de signes distincts (2 pour vital, 3 sinon).
 *
 * Approche : on tokenize uniquement symptom_type + symptom_label (PAS les
 * notes, trop bruitées). On exclut les tokens trop génériques. On split le
 * red flag par virgules pour en faire des signes cliniques distincts.
 */

import type { SymptomLog } from "./symptoms";

export interface RedFlag {
  symptom_or_sign: string;
  context?: string;
  severity?: string;
  rationale?: string;
  action?: string;
}

export interface RedFlagMatch {
  redFlag: RedFlag;
  matchedSigns: string[]; // signes distincts du red flag couverts
  newSymptomContributes: boolean;
}

/** Tokens trop génériques pour porter une signification clinique. */
const GENERIC_TOKENS = new Set([
  "douleur", "douleurs", "severe", "severes", "rapide", "rapides",
  "majeure", "majeur", "leger", "legere", "intense", "modere", "moderee",
  "perte", "gain", "augmentation", "diminution", "presence", "absence",
  "matin", "soir", "nuit", "jour", "semaine", "patient", "patiente",
  "sous", "apres", "avant", "pour", "dans", "avec", "sans", "chez",
  "etre", "tout", "tres", "plus", "moins", "cette", "celle", "leur",
  "leurs", "mais", "donc", "dont", "comme", "entre", "depuis", "vers",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[\s,;.·/\\()]+/)
    .filter((w) => w.length >= 4 && !GENERIC_TOKENS.has(w));
}

/** Split un red flag en signes cliniques distincts. */
function extractSigns(redFlagText: string): string[] {
  return redFlagText
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function signMatches(sign: string, userTokens: Set<string>): boolean {
  const signTokens = tokenize(sign);
  if (signTokens.length === 0) return false;
  // Au moins un token significatif du signe doit apparaître chez l'utilisateur
  return signTokens.some((t) =>
    Array.from(userTokens).some((ut) => ut === t || ut.includes(t) || t.includes(ut)),
  );
}

/**
 * Détection ciblée : retourne un match SI le nouveau symptôme contribue
 * lui-même à un red flag et que le seuil global est atteint.
 *
 * @param newSymptom Le symptôme qu'on vient d'insérer
 * @param recentSymptoms Les symptômes des 48h récentes EXCLUANT le nouveau
 * @param redFlags Liste des red flags de la KB cancer
 */
export function detectRedFlagForNewSymptom(
  newSymptom: Pick<SymptomLog, "symptom_type" | "symptom_label" | "category">,
  recentSymptoms: Pick<SymptomLog, "symptom_type" | "symptom_label" | "category">[],
  redFlags: RedFlag[],
): RedFlagMatch | null {
  // Wellbeing seul ne peut JAMAIS déclencher un red flag (c'est un score, pas un symptôme)
  if (newSymptom.category === "wellbeing") return null;
  if (redFlags.length === 0) return null;

  const newTokens = new Set([
    ...tokenize(newSymptom.symptom_type ?? ""),
    ...tokenize(newSymptom.symptom_label ?? ""),
  ]);
  if (newTokens.size === 0) return null;

  // Tokens des 48h récentes (hors wellbeing)
  const recentTokens = new Set<string>();
  for (const s of recentSymptoms) {
    if (s.category === "wellbeing") continue;
    tokenize(s.symptom_type ?? "").forEach((t) => recentTokens.add(t));
    tokenize(s.symptom_label ?? "").forEach((t) => recentTokens.add(t));
  }

  const combinedTokens = new Set([...newTokens, ...recentTokens]);

  let best: RedFlagMatch | null = null;
  for (const rf of redFlags) {
    const signs = extractSigns(rf.symptom_or_sign);
    if (signs.length === 0) continue;

    // Le nouveau symptôme contribue-t-il à au moins un signe ?
    const newContributesSigns = signs.filter((sign) => signMatches(sign, newTokens));
    if (newContributesSigns.length === 0) continue;

    // Compte total de signes distincts couverts (nouveau + récents)
    const coveredSigns = signs.filter((sign) => signMatches(sign, combinedTokens));

    const threshold = rf.severity === "vital" ? 2 : 3;
    if (coveredSigns.length >= threshold) {
      if (!best || coveredSigns.length > best.matchedSigns.length) {
        best = {
          redFlag: rf,
          matchedSigns: coveredSigns,
          newSymptomContributes: true,
        };
      }
    }
  }
  return best;
}
