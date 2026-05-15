/**
 * Helpers d'affichage pour le module Medication (Lot 1).
 * Formatters et mappings pour les composants UI côté client.
 */

import type {
  Database,
  MedicationRoute,
  MedicationStatus,
} from "@/types/database";

export type Medication = Database["public"]["Tables"]["medications"]["Row"];

/** Libellés français des voies d'administration. */
const ROUTE_LABELS: Record<MedicationRoute, string> = {
  oral: "Orale",
  im: "IM",
  iv: "IV",
  sc: "SC",
  topical: "Topique",
  inhaled: "Inhalée",
  sublingual: "Sublinguale",
  other: "Autre",
};

export function getRouteLabel(route: MedicationRoute): string {
  return ROUTE_LABELS[route] ?? "Autre";
}

/** Libellés français des statuts. */
const STATUS_LABELS: Record<MedicationStatus, string> = {
  active: "Actif",
  stopped: "Arrêté",
  paused: "Suspendu",
  planned: "Planifié",
};

export function getStatusLabel(status: MedicationStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Classes Tailwind cohérentes avec le design système (tokens du repo :
 * surface-card, ink, muted, hairline, warning).
 */
export function getStatusBadgeClass(status: MedicationStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "stopped":
      return "bg-zinc-100 text-zinc-600 border border-zinc-200";
    case "paused":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "planned":
      return "bg-sky-50 text-sky-700 border border-sky-200";
    default:
      return "bg-surface-card text-muted border border-hairline";
  }
}

/** Compte les médicaments par statut. */
export function countByStatus(
  medications: Medication[],
): Record<MedicationStatus, number> {
  const counts: Record<MedicationStatus, number> = {
    active: 0,
    stopped: 0,
    paused: 0,
    planned: 0,
  };
  for (const m of medications) {
    counts[m.status] = (counts[m.status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Format compact en ligne : "500 mg · cp · 1 cp matin et soir".
 * Utilisé dans MedicationCard pour l'affichage rapide.
 */
export function formatPosologyInline(med: Medication): string {
  const parts = [med.dosage, med.form, med.posology].filter(Boolean);
  return parts.join(" · ");
}

/** Date FR sans `date-fns` (économise une dépendance déjà légère côté UI). */
export function formatDateFR(date: string | null | undefined): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString("fr-FR");
  } catch {
    return null;
  }
}

/** Options pour le select "Forme" du formulaire. */
export const FORM_OPTIONS: { value: string; label: string }[] = [
  { value: "comprimé", label: "Comprimé" },
  { value: "gélule", label: "Gélule" },
  { value: "sachet", label: "Sachet" },
  { value: "sirop", label: "Sirop" },
  { value: "ampoule injectable", label: "Ampoule injectable" },
  { value: "patch", label: "Patch" },
  { value: "crème", label: "Crème" },
  { value: "spray", label: "Spray" },
  { value: "autre", label: "Autre" },
];

/** Options pour le select "Voie d'administration" du formulaire. */
export const ROUTE_OPTIONS: { value: MedicationRoute; label: string }[] = [
  { value: "oral", label: "Orale" },
  { value: "im", label: "IM" },
  { value: "iv", label: "IV" },
  { value: "sc", label: "SC" },
  { value: "topical", label: "Topique" },
  { value: "inhaled", label: "Inhalée" },
  { value: "sublingual", label: "Sublinguale" },
  { value: "other", label: "Autre" },
];

/** Options pour les radios "Statut" du formulaire. */
export const STATUS_OPTIONS: { value: MedicationStatus; label: string }[] = [
  { value: "active", label: "Actif" },
  { value: "planned", label: "Planifié" },
  { value: "paused", label: "Suspendu" },
  { value: "stopped", label: "Arrêté" },
];
