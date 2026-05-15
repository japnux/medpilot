"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MarkerDef } from "@/lib/cancer-profiles";
import {
  getMarkerStatus,
  getStatusColor,
  getStatusLabel,
  computeReferenceZones,
} from "@/lib/markers";
import { formatDateFr, formatDateShort } from "@/lib/dates";
import { categorizeMarker, MARKER_CATEGORIES } from "@/lib/marker-categories";

interface Record {
  recorded_at: string;
  value: number;
  unit: string;
  alert_level: "normal" | "warning" | "critical" | null;
  source: {
    id: string;
    title: string;
    doctor_name: string | null;
    document_type: string;
  } | null;
}

interface Props {
  markerKey: string;
  marker: MarkerDef;
  /** Triés par date desc (le plus récent en premier). */
  records: Record[];
}

export default function MarkerDetailClient({ markerKey, marker, records }: Props) {
  const last = records[0];
  const status = getMarkerStatus(last.value, marker);
  const statusColor = getStatusColor(status);
  const category = MARKER_CATEGORIES.find((c) => c.key === categorizeMarker(markerKey));

  // Données du chart (date asc)
  const chartData = [...records]
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((r) => ({
      date: r.recorded_at,
      dateLabel: formatDateShort(r.recorded_at),
      value: r.value,
    }));

  const zones = computeReferenceZones(marker);
  const targetZone =
    marker.target_min != null && marker.target_max != null
      ? { y1: marker.target_min, y2: marker.target_max }
      : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link
        href="/biologie"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour à la biologie
      </Link>

      {/* En-tête */}
      <header className="card-feature space-y-3">
        <div className="flex items-center gap-2">
          {category && (
            <span className="badge-pill">
              <span>{category.emoji}</span> {category.label}
            </span>
          )}
        </div>
        <h1 className="text-ink">{marker.label}</h1>
        {marker.description && (
          <p className="text-sm text-body max-w-2xl">{marker.description}</p>
        )}

        <div className="flex items-baseline gap-3 flex-wrap pt-2">
          <span
            className="text-4xl font-light tabular"
            style={{ color: statusColor, fontWeight: 300 }}
          >
            {formatValue(last.value)}
          </span>
          <span className="text-sm text-muted">{marker.unit}</span>
          <span
            className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider"
            style={{
              color: statusColor,
              backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${statusColor} 35%, transparent)`,
            }}
          >
            {getStatusLabel(status)}
          </span>
          <span className="text-xs text-muted ml-auto">
            mesuré le {formatDateFr(last.recorded_at)}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted pt-2 border-t border-hairline-soft">
          <span>
            <span className="font-medium text-ink">Plage cible : </span>
            {formatRange(marker)}
          </span>
          {marker.alert_min != null || marker.alert_max != null ? (
            <span>
              <span className="font-medium text-ink">Alerte : </span>
              {marker.alert_min != null && `< ${marker.alert_min}`}
              {marker.alert_min != null && marker.alert_max != null && " · "}
              {marker.alert_max != null && `> ${marker.alert_max}`}
            </span>
          ) : null}
          <span className="ml-auto">{records.length} mesure{records.length > 1 ? "s" : ""}</span>
        </div>
      </header>

      {/* Chart */}
      {chartData.length >= 2 && (
        <article className="card-feature">
          <h2 className="text-sm font-medium text-ink mb-3">Évolution</h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 8, left: 12 }}>
                <CartesianGrid stroke="var(--hairline-soft)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="var(--muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--canvas)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--ink)" }}
                  formatter={(v) => [`${v} ${marker.unit}`, marker.label]}
                />
                {/* Zone cible (vert subtil) */}
                {targetZone && (
                  <ReferenceArea
                    y1={targetZone.y1}
                    y2={targetZone.y2}
                    fill="var(--success)"
                    fillOpacity={0.08}
                    stroke="none"
                  />
                )}
                {/* Lignes seuils */}
                {zones.map((z, i) => (
                  <ReferenceLine
                    key={i}
                    y={z.y}
                    stroke={z.color}
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{
                      value: z.label,
                      fontSize: 10,
                      fill: z.color,
                      position: "right",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={marker.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: marker.color }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      )}

      {/* Table d'historique */}
      <article className="card-feature p-0 overflow-hidden">
        <header className="px-5 py-3 border-b border-hairline">
          <h2 className="text-sm font-medium text-ink">Historique des mesures</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-soft uppercase tracking-wider bg-canvas-soft">
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium text-right">Valeur</th>
                <th className="py-2.5 px-4 font-medium text-right">Δ</th>
                <th className="py-2.5 px-4 font-medium">Statut</th>
                <th className="py-2.5 px-4 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const prev = records[i + 1]; // suivant dans l'array desc = mesure précédente chronologique
                const delta = prev ? r.value - prev.value : null;
                const rowStatus = getMarkerStatus(r.value, marker);
                const rowColor = getStatusColor(rowStatus);
                return (
                  <tr key={i} className="border-t border-hairline-soft hover:bg-canvas-soft">
                    <td className="py-2.5 px-4 text-body">{formatDateFr(r.recorded_at)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span
                        className="tabular font-medium"
                        style={{ color: rowColor }}
                      >
                        {formatValue(r.value)}
                      </span>{" "}
                      <span className="text-[10px] text-muted">{r.unit}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {delta != null ? <DeltaCell delta={delta} marker={marker} /> : (
                        <span className="text-muted-soft text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          color: rowColor,
                          backgroundColor: `color-mix(in srgb, ${rowColor} 12%, transparent)`,
                        }}
                      >
                        {getStatusLabel(rowStatus)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {r.source ? (
                        <Link
                          href={`/documents/${r.source.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:text-primary-deep"
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[180px]">{r.source.title}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-soft">manuel</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function DeltaCell({ delta, marker }: { delta: number; marker: MarkerDef }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted tabular">
        <Minus className="w-3 h-3" /> 0
      </span>
    );
  }
  // Pour "less is better" markers (target_max only), hausse = warning ; baisse = success
  const lessIsBetter = marker.target_max != null && marker.target_min == null;
  const moreIsBetter = marker.target_min != null && marker.target_max == null;
  let color = "var(--muted)";
  if (lessIsBetter) color = delta > 0 ? "var(--warning)" : "var(--success)";
  else if (moreIsBetter) color = delta > 0 ? "var(--success)" : "var(--warning)";
  return (
    <span className="inline-flex items-center gap-0.5 text-xs tabular" style={{ color }}>
      {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? "+" : ""}
      {formatValue(delta)}
    </span>
  );
}

function formatValue(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatRange(m: MarkerDef): string {
  if (m.target_min != null && m.target_max != null) return `${m.target_min}–${m.target_max} ${m.unit}`;
  if (m.target_max != null) return `≤ ${m.target_max} ${m.unit}`;
  if (m.target_min != null) return `≥ ${m.target_min} ${m.unit}`;
  return "non définie";
}
