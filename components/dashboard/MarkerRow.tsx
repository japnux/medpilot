"use client";

import Link from "next/link";
import type { MarkerDef } from "@/lib/cancer-profiles";
import { getMarkerStatus, getStatusColor } from "@/lib/markers";

interface Props {
  markerKey: string;
  marker: MarkerDef;
  /** Mesures triées par date desc (la plus récente en premier). */
  records: Array<{ recorded_at: string; value: number }>;
}

/**
 * Row compacte pour un marqueur biologique (pattern Health-dashboard).
 * Layout : [dot status]  [label]  [mini-sparkline]  [valeur unité]  [plage cible]
 * Click → /biologie/marqueur/[markerKey] pour le détail complet.
 */
export default function MarkerRow({ markerKey, marker, records }: Props) {
  const last = records[0];
  const status = last ? getMarkerStatus(last.value, marker) : null;
  const statusColor = status ? getStatusColor(status) : "var(--muted-soft)";

  // Sparkline = valeurs en ordre chronologique (asc)
  const sparklineValues = [...records]
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((r) => r.value);

  return (
    <Link
      href={`/biologie/marqueur/${markerKey}`}
      className="flex items-center gap-3 py-2.5 px-3 border-b border-hairline-soft last:border-b-0 hover:bg-canvas-soft transition-colors"
    >
      {/* Dot status */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: statusColor }}
      />

      {/* Label */}
      <span className="text-sm text-ink min-w-[100px] sm:min-w-[140px] truncate">
        {marker.label}
      </span>

      {/* Mini-sparkline */}
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
    </Link>
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
  const width = 140;
  const height = 32;
  const padX = 4;
  const padY = 4;
  const w = width - padX * 2;
  const h = height - padY * 2;

  if (values.length === 0) {
    return <div style={{ width, height }} />;
  }

  const targetMin = marker.target_min ?? null;
  const targetMax = marker.target_max ?? null;
  // Inclure les bornes target dans l'échelle pour bien situer la zone
  const visualMin = Math.min(...values, targetMin ?? Infinity);
  const visualMax = Math.max(...values, targetMax ?? -Infinity);
  let range = visualMax - visualMin;
  if (range <= 0) range = Math.max(1, Math.abs(visualMin) * 0.1);

  // 1 seule mesure : on affiche juste le rect target + le point sur la ligne
  if (values.length === 1) {
    const cx = padX + w / 2;
    const cy = padY + h - ((values[0] - visualMin) / range) * h;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
        <TargetRect
          padX={padX}
          padY={padY}
          w={w}
          h={h}
          visualMin={visualMin}
          range={range}
          targetMin={targetMin}
          targetMax={targetMax}
        />
        <circle cx={cx} cy={cy} r={3} fill={pointColor(status)} />
      </svg>
    );
  }

  // Plusieurs mesures : ligne + points
  const step = w / (values.length - 1);
  const coords = values.map((v, i) => ({
    x: padX + i * step,
    y: padY + h - ((v - visualMin) / range) * h,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const lineColor = pointColor(status);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <TargetRect
        padX={padX}
        padY={padY}
        w={w}
        h={h}
        visualMin={visualMin}
        range={range}
        targetMin={targetMin}
        targetMax={targetMax}
      />
      {/* Ligne entre points */}
      <path
        d={linePath}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Points intermédiaires (petits) */}
      {coords.slice(0, -1).map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={1.5} fill={lineColor} opacity={0.7} />
      ))}
      {/* Dernier point (plus gros, mis en évidence) */}
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r={2.75}
        fill={lineColor}
      />
    </svg>
  );
}

function TargetRect({
  padX,
  padY,
  w,
  h,
  visualMin,
  range,
  targetMin,
  targetMax,
}: {
  padX: number;
  padY: number;
  w: number;
  h: number;
  visualMin: number;
  range: number;
  targetMin: number | null;
  targetMax: number | null;
}) {
  if (targetMin == null && targetMax == null) return null;
  const tMin = targetMin ?? visualMin;
  const tMax = targetMax ?? visualMin + range;
  const y1 = padY + h - ((tMax - visualMin) / range) * h;
  const y2 = padY + h - ((tMin - visualMin) / range) * h;
  const rectH = Math.max(2, y2 - y1);
  return (
    <rect
      x={padX}
      y={y1}
      width={w}
      height={rectH}
      fill="var(--success)"
      opacity={0.12}
      rx={2}
    />
  );
}

function pointColor(status: string | null): string {
  if (status === "critical") return "var(--error)";
  if (status === "warning") return "var(--warning)";
  if (status === "normal") return "var(--success)";
  return "var(--muted-soft)";
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
