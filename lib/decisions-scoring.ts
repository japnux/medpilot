/**
 * Scoring Top 3 : algorithme déterministe basé sur urgence + priorité +
 * catégorie + statut. Recalcul à chaque chargement (pas de table dédiée).
 */

import type { DecisionRow } from "./decisions";

const ACTIVE_STATUSES: ReadonlyArray<DecisionRow["status"]> = [
  "pending",
  "awaiting_team",
  "awaiting_result",
];

export function scoreDecision(d: DecisionRow): number {
  let score = 0;
  const now = Date.now();

  if (d.due_date) {
    const days = Math.floor(
      (new Date(d.due_date).getTime() - now) / 86_400_000,
    );
    if (days < 0) score += 4;
    else if (days < 7) score += 5;
    else if (days < 14) score += 3;
    else if (days < 30) score += 1;
  }

  if (d.priority === "high") score += 3;
  if (d.priority === "low") score -= 1;

  if (d.category === "essai_clinique") score += 2;
  if (d.category === "second_avis") score += 2;
  if (d.category === "surveillance") score += 1;

  if (d.status === "pending") score += 2;

  if (d.is_pinned) score += 100;

  return score;
}

export function selectTop3(decisions: DecisionRow[]): DecisionRow[] {
  return decisions
    .filter((d) => ACTIVE_STATUSES.includes(d.status))
    .map((d) => ({ d, score: scoreDecision(d) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ d }) => d);
}

/**
 * Catégorisation de l'urgence pour le badge couleur.
 */
export type UrgencyLevel =
  | "overdue"
  | "today"
  | "this_week"
  | "this_month"
  | "later"
  | "none";

export function urgencyLevel(dueDate: string | null): {
  level: UrgencyLevel;
  days: number | null;
} {
  if (!dueDate) return { level: "none", days: null };
  const days = Math.floor(
    (new Date(dueDate).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return { level: "overdue", days };
  if (days === 0) return { level: "today", days };
  if (days <= 7) return { level: "this_week", days };
  if (days <= 30) return { level: "this_month", days };
  return { level: "later", days };
}

export function urgencyMeta(level: UrgencyLevel): {
  color: string;
  border: string;
} {
  switch (level) {
    case "overdue":
      return { color: "#dc2626", border: "border-error/60" };
    case "today":
      return { color: "#ea580c", border: "border-warning/60" };
    case "this_week":
      return { color: "#f59e0b", border: "border-warning/30" };
    case "this_month":
      return { color: "#eab308", border: "border-yellow-500/30" };
    case "later":
      return { color: "#64748b", border: "border-hairline" };
    case "none":
      return { color: "#94a3b8", border: "border-hairline" };
  }
}
