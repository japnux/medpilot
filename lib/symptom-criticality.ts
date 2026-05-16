/**
 * Détection de red flags : matching de mots-clés entre les symptômes
 * récents (24-48h) et la KB cancer (red_flags). Si suffisamment de
 * mots-clés matchent un red flag, on flagge le symptôme courant comme
 * critique.
 *
 * Seuils : 2 keywords pour la plupart, 1 pour severity='vital'.
 * Pas d'archivage auto : on remonte le match à l'UI qui affiche un
 * encart bloquant avec la conduite à tenir.
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
  matchedKeywords: string[];
  score: number;
}

/** Mots vides à exclure du matching (trop génériques). */
const STOPWORDS = new Set([
  "patient", "sous", "apres", "avant", "pour", "dans", "avec", "sans",
  "dune", "duke", "etre", "tout", "tres", "plus", "cette", "celle", "moins",
  "vers", "chez", "leur", "leurs", "mais", "donc", "dont", "comme", "entre",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[\s,;.·\/\\()]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

/**
 * Cherche le meilleur red flag matché par les symptômes récents.
 * Retourne null si aucun red flag n'atteint le seuil.
 */
export function detectRedFlagMatches(
  recentSymptoms: Pick<
    SymptomLog,
    "symptom_type" | "symptom_label" | "notes" | "category"
  >[],
  redFlags: RedFlag[],
): RedFlagMatch | null {
  if (redFlags.length === 0) return null;

  // Tokens issus des symptômes récents
  const symptomTokens = new Set<string>();
  for (const s of recentSymptoms) {
    if (s.symptom_type) tokenize(s.symptom_type).forEach((t) => symptomTokens.add(t));
    if (s.symptom_label) tokenize(s.symptom_label).forEach((t) => symptomTokens.add(t));
    if (s.notes) tokenize(s.notes).forEach((t) => symptomTokens.add(t));
  }
  if (symptomTokens.size === 0) return null;

  let best: RedFlagMatch | null = null;
  for (const rf of redFlags) {
    const flagText = `${rf.symptom_or_sign ?? ""} ${rf.context ?? ""}`;
    const flagTokens = tokenize(flagText);
    if (flagTokens.length === 0) continue;

    const matched = flagTokens.filter((kw) => {
      for (const st of symptomTokens) {
        if (st.includes(kw) || kw.includes(st)) return true;
      }
      return false;
    });
    if (matched.length === 0) continue;

    const threshold = rf.severity === "vital" ? 1 : 2;
    if (matched.length >= threshold) {
      if (!best || matched.length > best.score) {
        best = {
          redFlag: rf,
          matchedKeywords: Array.from(new Set(matched)),
          score: matched.length,
        };
      }
    }
  }
  return best;
}
