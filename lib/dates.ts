/**
 * Helpers de formatage de dates en FR.
 * Réutilise date-fns pour les formats lisibles.
 */
import { format as dfFormat, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

/** "2026-05-15" → "15 mai 2026" */
export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return dfFormat(parseISO(iso), "d MMMM yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

/** "2026-05-15" → "15/05/2026" */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return dfFormat(parseISO(iso), "dd/MM/yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

/** Aujourd'hui au format YYYY-MM-DD */
export function today(): string {
  return dfFormat(new Date(), "yyyy-MM-dd");
}
