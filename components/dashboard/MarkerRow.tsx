"use client";

import type { MarkerDef } from "@/lib/cancer-profiles";
import { getMarkerStatus, getStatusColor } from "@/lib/markers";

interface Props {
  marker: MarkerDef;
  /** Mesures triées par date desc (la plus récente en premier). */
  records: Array<{ recorded_at: string; value: number }>;
}

/**
 * Row compacte pour un marqueur biologique (pattern Health-dashboard).
 * Layout : [dot status]  [label]  [mini-sparkline]  [valeur unité]  [plage cible]
 */
export default function MarkerRow({ marker, records }: Props) {
  const last = records[0];
  const status = last ? getMarkerStatus(last.value, marker) : null;
  const statusColor = status ? getStatusColor(status) : "var(--muted-soft)";

  // Sparkline = valeurs en ordre chronologique (asc)
  const sparklineValues = [...records]
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((r) => r.value);

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 border-b border-hairline-soft last:border-b-0 hover:bg-canvas-soft transition-colors">
      {/* Dot status */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: statusColor }}
      />

      {/* Label */}
      <span className="text-sm text-ink min-w-[100px] sm:min-w-[140px] truncate">
        {marker.label}
      </span>

      {/* Mini-sparkline (vide si trop peu de mesures) */}
      <div className="flex-1 flex justify-center">
        <CompactSparkline marker={marker} values={sparklineValues} status={status} />
      </div>

      {/* Valeur */}
      <div className="text-right min-w-[80px]">
        {last ? (
          <>
            <span
              className="text-sm tabular font-medium"
              style={{ color: statusColor }}
            >
              {formatValue(last.value)}
            </span>{" "}
            <span className="text-[10px] text-muted">{marker.unit}</span>
          </>
        ) : (
          <span className="text-xs text-muted-soft italic">—</span>
        )}
      </div>

      {/* Plage cible */}
      <span className="text-[11px] text-muted-soft tabular hidden sm:inline min-w-[60px] text-right">
        {formatRange(marker)}
      </span>
    </div>
  );
}

function CompactSparkline({
  marker,
  values,
  status,
}: {
  marker: MarkerDef;
  values: number[];
  status: string | null;
}) {
  if (values.length < 2) {
    return <div style={{ width: 100, height: 22 }} />;
  }
  const width = 100;
  const height = 22;
  const targetMin = marker.target_min ?? null;
  const targetMax = marker.target_max ?? null;
  const visualMin = Math.min(...values, targetMin ?? Infinity);
  const visualMax = Math.max(...values, targetMax ?? -Infinity);
  const range = visualMax - visualMin || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${height - ((v - visualMin) / range) * (height - 4) - 2}`)
    .join(" ");

  const lineColor =
    status === "critical"
      ? "var(--error)"
      : status === "warning"
        ? "var(--warning)"
        : "var(--success)";

  // Rect cible (vert subtil) si target_min ET target_max
  const targetRect =
    targetMin != null && targetMax != null
      ? {
          y: height - ((targetMax - visualMin) / range) * (height - 4) - 2,
          h: ((targetMax - targetMin) / range) * (height - 4),
        }
      : null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {targetRect && (
        <rect
          x={0}
          y={targetRect.y}
          width={width}
          height={Math.max(2, targetRect.h)}
          fill="var(--success)"
          opacity={0.08}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={(values.length - 1) * step}
        cy={
          height -
          ((values[values.length - 1] - visualMin) / range) * (height - 4) -
          2
        }
        r={2}
        fill={lineColor}
      />
    </svg>
  );
}

function formatValue(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatRange(m: MarkerDef): string {
  if (m.target_min != null && m.target_max != null) return `${m.target_min}–${m.target_max}`;
  if (m.target_max != null) return `< ${m.target_max}`;
  if (m.target_min != null) return `> ${m.target_min}`;
  return "—";
}
