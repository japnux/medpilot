"use client";

import type { MarkerDef } from "@/lib/cancer-profiles";
import {
  getMarkerStatus,
  getStatusColor,
  getStatusLabel,
} from "@/lib/markers";
import { formatDateShort } from "@/lib/dates";
import BiologyChart from "./BiologyChart";

interface Props {
  markerKey: string;
  marker: MarkerDef;
  records: Array<{ recorded_at: string; value: number }>;
}

/**
 * Carte d'un marqueur : dernière valeur + statut + graphique d'évolution.
 */
export default function MarkerCard({ marker, records }: Props) {
  const last = records[0];
  const status = last ? getMarkerStatus(last.value, marker) : null;
  const color = status ? getStatusColor(status) : "#64748b";

  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">{marker.label}</h3>
          {marker.description && (
            <p className="text-[11px] text-muted mt-0.5">
              {marker.description}
            </p>
          )}
        </div>
        {status && (
          <span
            className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium"
            style={{
              backgroundColor: `${color}1a`,
              color: color,
              border: `1px solid ${color}40`,
            }}
          >
            {getStatusLabel(status)}
          </span>
        )}
      </div>

      {last ? (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-ink">
            {last.value}
          </span>
          <span className="text-xs text-muted">{marker.unit}</span>
          <span className="ml-auto text-[11px] text-muted">
            {formatDateShort(last.recorded_at)}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted italic">Aucune mesure</p>
      )}

      {records.length >= 2 && (
        <BiologyChart
          marker={marker}
          data={records.map((r) => ({ date: r.recorded_at, value: r.value }))}
        />
      )}
    </div>
  );
}
