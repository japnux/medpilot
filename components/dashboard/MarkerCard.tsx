"use client";

import type { MarkerDef } from "@/lib/cancer-profiles";
import {
  getMarkerStatus,
  getStatusColor,
  getStatusLabel,
} from "@/lib/markers";
import { formatDateShort } from "@/lib/dates";
import Sparkline from "./Sparkline";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  markerKey: string;
  marker: MarkerDef;
  /** Mesures triées par date desc (la plus récente en premier). */
  records: Array<{ recorded_at: string; value: number }>;
}

/**
 * Carte d'un marqueur :
 *  - Valeur actuelle (grande) + unité
 *  - Delta vs mesure précédente (flèche colorée) + date dernière mesure
 *  - Sparkline horizontale des dernières valeurs avec zone cible
 *  - Badge statut + plage cible texte
 */
export default function MarkerCard({ marker, records }: Props) {
  const last = records[0];
  const prev = records[1];
  const status = last ? getMarkerStatus(last.value, marker) : null;
  const statusColor = status ? getStatusColor(status) : "var(--muted-soft)";

  // Delta calculé entre dernière et avant-dernière mesure
  const delta = last && prev ? last.value - prev.value : null;
  const deltaPct =
    last && prev && prev.value !== 0
      ? ((last.value - prev.value) / prev.value) * 100
      : null;

  // Sparkline = valeurs en ordre chronologique (asc)
  const sparklineValues = [...records]
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((r) => r.value);

  return (
    <article className="card-feature">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink truncate">{marker.label}</h3>
          {marker.description && (
            <p className="text-[11px] text-muted mt-0.5 line-clamp-2">
              {marker.description}
            </p>
          )}
        </div>
        {status && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold shrink-0"
            style={{
              color: statusColor,
              backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${statusColor} 35%, transparent)`,
            }}
          >
            {getStatusLabel(status)}
          </span>
        )}
      </header>

      {last ? (
        <>
          {/* Valeur principale */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-display text-3xl text-ink" style={{ fontWeight: 300 }}>
              {formatValue(last.value)}
            </span>
            <span className="text-xs text-muted">{marker.unit}</span>
            {delta != null && (
              <span
                className="ml-auto inline-flex items-center gap-1 text-[11px]"
                style={{ color: getDeltaColor(delta, marker) }}
                title={`Variation : ${delta > 0 ? "+" : ""}${formatValue(delta)} ${marker.unit}`}
              >
                <DeltaIcon delta={delta} />
                {deltaPct != null
                  ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`
                  : `${delta > 0 ? "+" : ""}${formatValue(delta)}`}
              </span>
            )}
          </div>

          {/* Sparkline + plage cible */}
          <Sparkline
            values={sparklineValues}
            color={marker.color}
            width={240}
            height={32}
            targetMin={marker.target_min ?? null}
            targetMax={marker.target_max ?? null}
          />

          {/* Footer : plage cible + date */}
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted">
            <span>
              {formatRange(marker)}
            </span>
            <span>{formatDateShort(last.recorded_at)}</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted italic py-4 text-center">
          Aucune mesure enregistrée
        </p>
      )}
    </article>
  );
}

/** Formatte un nombre français avec au plus 2 décimales. */
function formatValue(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

/** Décrit la zone cible/alerte du marqueur en texte court. */
function formatRange(m: MarkerDef): string {
  if (m.target_min != null && m.target_max != null) {
    return `Cible ${m.target_min}–${m.target_max} ${m.unit}`;
  }
  if (m.target_max != null) return `≤ ${m.target_max} ${m.unit}`;
  if (m.target_min != null) return `≥ ${m.target_min} ${m.unit}`;
  return "Pas de plage de référence";
}

/**
 * Couleur du delta selon le sens de la variation et la position vs cible.
 * Pour un marqueur avec borne haute (target_max) : hausse = warning.
 * Pour un marqueur avec borne basse (target_min) : baisse = warning.
 * Sinon : neutre (slate).
 */
function getDeltaColor(delta: number, marker: MarkerDef): string {
  if (delta === 0) return "var(--muted)";
  // Marqueur "less is better" (cholestérol, ALAT…)
  if (marker.target_max != null && marker.target_min == null) {
    return delta > 0 ? "var(--warning)" : "var(--success)";
  }
  // Marqueur "more is better" (rare)
  if (marker.target_min != null && marker.target_max == null) {
    return delta > 0 ? "var(--success)" : "var(--warning)";
  }
  // Marqueur "in range" : neutre — l'écart n'est pas forcément mauvais
  return "var(--muted)";
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta === 0) return <Minus className="w-3 h-3" />;
  return delta > 0 ? (
    <TrendingUp className="w-3 h-3" />
  ) : (
    <TrendingDown className="w-3 h-3" />
  );
}
