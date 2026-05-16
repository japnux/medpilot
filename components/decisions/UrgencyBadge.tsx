"use client";

import { formatDateFr } from "@/lib/dates";
import { urgencyLevel, urgencyMeta } from "@/lib/decisions-urgency";

/**
 * Pill d'urgence pour une échéance de décision.
 * Couleur graduée : rouge (en retard), orange (semaine), jaune (mois),
 * gris (au-delà ou sans échéance).
 */
export default function UrgencyBadge({
  dueDate,
  className = "",
}: {
  dueDate: string | null;
  className?: string;
}) {
  const { level, days } = urgencyLevel(dueDate);
  const meta = urgencyMeta(level);

  let label = "Sans échéance";
  if (level === "overdue" && days !== null) {
    label = `En retard ${Math.abs(days)}j`;
  } else if (level === "today") {
    label = "Aujourd'hui";
  } else if (level === "this_week" && days !== null) {
    label = `Dans ${days}j`;
  } else if (level === "this_month" && days !== null) {
    label = `Dans ${days}j`;
  } else if (level === "later" && dueDate) {
    label = formatDateFr(dueDate);
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${className}`}
      style={{
        color: meta.color,
        backgroundColor: `${meta.color}1a`,
        border: `1px solid ${meta.color}40`,
      }}
    >
      {label}
    </span>
  );
}
