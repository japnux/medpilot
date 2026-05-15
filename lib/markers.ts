/**
 * Utils marqueurs biologiques.
 *
 * Logique de statut :
 * - Si la valeur est dans la zone cible [target_min, target_max] → "normal"
 * - Si elle est entre target et alert (inclus) → "warning"
 * - Si elle franchit un seuil alert (hors [alert_min, alert_max]) → "critical"
 *
 * Cas particuliers :
 * - target_min ou target_max null : la borne n'est pas évaluée (ex : ACE,
 *   on n'a qu'une borne haute).
 * - alert_min ou alert_max null : pas de seuil critique de ce côté (ex :
 *   cortisol, on n'a pas de plafond critique strict en pratique courante).
 */

import type { CancerProfile, MarkerDef } from "./cancer-profiles";
import { CANCER_PROFILES } from "./cancer-profiles";
import type { AlertLevel } from "@/types/database";

/** Retourne la définition d'un marqueur pour un cancer_type donné. */
export function getMarkerConfig(
  cancerType: string,
  markerName: string,
  customMarkers?: Record<string, MarkerDef> | null
): MarkerDef | null {
  // Profil custom : utiliser les marqueurs définis à l'onboarding
  if (cancerType === "custom" && customMarkers) {
    return customMarkers[markerName] ?? null;
  }
  const profile: CancerProfile | undefined = CANCER_PROFILES[cancerType];
  if (!profile) return null;
  return profile.markers[markerName] ?? null;
}

/**
 * Calcule le statut d'une valeur par rapport à son marqueur.
 * Retourne "normal" | "warning" | "critical".
 */
export function getMarkerStatus(value: number, marker: MarkerDef): AlertLevel {
  // 1. Vérif des seuils critiques d'abord (les plus stricts)
  if (marker.alert_min != null && value < marker.alert_min) return "critical";
  if (marker.alert_max != null && value > marker.alert_max) return "critical";

  // 2. Vérif des bornes cibles. Si dans la zone → normal.
  const inTargetLow =
    marker.target_min == null || value >= marker.target_min;
  const inTargetHigh =
    marker.target_max == null || value <= marker.target_max;

  if (inTargetLow && inTargetHigh) return "normal";

  // 3. Sinon, on est entre target et alert → warning
  return "warning";
}

/**
 * Indique si une valeur est hors normes (warning ou critical).
 * Utile pour le champ `out_of_range` de biology_records.
 */
export function isOutOfRange(value: number, marker: MarkerDef): boolean {
  return getMarkerStatus(value, marker) !== "normal";
}

/** Type de zone Recharts (pour <ReferenceArea> ou <ReferenceLine>). */
export interface ReferenceZone {
  /** Type de zone, utile pour styliser. */
  level: "target" | "alert";
  /** Valeur seuil (y). */
  y: number;
  /** Couleur recommandée. */
  color: string;
  /** Label (optionnel) pour tooltip. */
  label?: string;
}

/**
 * Construit les zones de référence à afficher en plus de la courbe.
 * Retourne 2 à 4 lignes selon les champs disponibles du marqueur.
 */
export function computeReferenceZones(marker: MarkerDef): ReferenceZone[] {
  const zones: ReferenceZone[] = [];
  // Cibles thérapeutiques (vert)
  if (marker.target_min != null) {
    zones.push({ level: "target", y: marker.target_min, color: "#10b981", label: "cible min" });
  }
  if (marker.target_max != null) {
    zones.push({ level: "target", y: marker.target_max, color: "#10b981", label: "cible max" });
  }
  // Seuils d'alerte (rouge)
  if (marker.alert_min != null) {
    zones.push({ level: "alert", y: marker.alert_min, color: "#ef4444", label: "alerte min" });
  }
  if (marker.alert_max != null) {
    zones.push({ level: "alert", y: marker.alert_max, color: "#ef4444", label: "alerte max" });
  }
  return zones;
}

/** Couleur d'un badge selon le statut. */
export function getStatusColor(status: AlertLevel): string {
  switch (status) {
    case "normal":
      return "#10b981";
    case "warning":
      return "#f59e0b";
    case "critical":
      return "#ef4444";
  }
}

/** Label FR d'un statut. */
export function getStatusLabel(status: AlertLevel): string {
  switch (status) {
    case "normal":
      return "Normal";
    case "warning":
      return "Surveillance";
    case "critical":
      return "Alerte";
  }
}
