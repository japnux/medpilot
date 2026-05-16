/**
 * Helpers d'urgence pour les décisions : catégorisation de l'échéance et
 * couleurs associées pour le badge.
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
