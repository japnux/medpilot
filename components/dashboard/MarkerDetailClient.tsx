"use client";

import { useEffect, useState } from "react";
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
import { ArrowLeft, FileText, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import type { MarkerDef } from "@/lib/cancer-profiles";
import {
  getMarkerStatus,
  getStatusColor,
  getStatusLabel,
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

  // Description lazy : si manquante, on la fetch via /api/markers/describe.
  // Une fois générée, elle est stockée en BDD (cancer_profiles.custom_markers).
  const [description, setDescription] = useState<string | null>(
    marker.description?.trim() ? marker.description : null,
  );
  const [loadingDescription, setLoadingDescription] = useState(false);

  useEffect(() => {
    if (description) return;
    let cancelled = false;
    setLoadingDescription(true);
    fetch("/api/markers/describe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marker_name: markerKey, marker_label: marker.label }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.description) setDescription(j.description);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDescription(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey]);

  // Données du chart (date asc)
  const chartData = [...records]
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map((r) => ({
      date: r.recorded_at,
      dateLabel: formatDateShort(r.recorded_at),
      value: r.value,
    }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Link
        href="/biologie?tab=markers"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour à la biologie
      </Link>

      {/* ========= Bloc 1 : Identité + valeur principale + description + plage ========= */}
      <article className="card-feature space-y-3">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0 flex-1">
            <h1 className="text-ink">{marker.label}</h1>
            <p className="text-xs text-muted">
              {category && (
                <>
                  <span aria-hidden>{category.emoji}</span> {category.label}
                </>
              )}
              {category && " · "}
              {marker.unit}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div
              className="font-light tabular leading-none"
              style={{ color: statusColor, fontSize: 40, fontWeight: 300 }}
            >
              {formatValue(last.value)}
            </div>
            <p className="text-[11px] mt-1 text-muted">
              {marker.unit} ·{" "}
              <span style={{ color: statusColor }}>{getStatusLabel(status)}</span>
            </p>
          </div>
        </header>

        {description ? (
          <p className="text-sm text-body leading-relaxed">{description}</p>
        ) : loadingDescription ? (
          <p className="text-xs text-muted italic inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 animate-pulse" />
            Génération de la description...
          </p>
        ) : null}

        {/* Plage optimale en bandeau vert */}
        <div className="inline-flex items-center gap-2">
          <span className="block w-8 h-2 rounded-full bg-success/30" aria-hidden />
          <span className="text-xs text-muted">
            Plage optimale&nbsp;: <span className="text-ink tabular">{formatRange(marker)}</span>
          </span>
        </div>
      </article>

      {/* ========= Bloc 2 : Évolution unifiée (graphe + table) ========= */}
      <article className="card-feature p-0 overflow-hidden">
        <header className="px-5 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-soft font-medium">
            Évolution
          </p>
        </header>

        {chartData.length >= 2 ? (
          <div className="px-2 pb-2">
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart
                  data={chartData}
                  margin={{ top: 16, right: 40, bottom: 8, left: 12 }}
                >
                  <CartesianGrid
                    stroke="var(--hairline-soft)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
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
                    width={36}
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
                  {/* Zone cible (rect vert subtil avec lignes pointillées aux bornes) */}
                  {marker.target_min != null && marker.target_max != null && (
                    <ReferenceArea
                      y1={marker.target_min}
                      y2={marker.target_max}
                      fill="var(--success)"
                      fillOpacity={0.1}
                      stroke="none"
                    />
                  )}
                  {marker.target_min != null && (
                    <ReferenceLine
                      y={marker.target_min}
                      stroke="var(--success)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{
                        value: marker.target_min,
                        position: "right",
                        fontSize: 10,
                        fill: "var(--success)",
                      }}
                    />
                  )}
                  {marker.target_max != null && (
                    <ReferenceLine
                      y={marker.target_max}
                      stroke="var(--success)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{
                        value: marker.target_max,
                        position: "right",
                        fontSize: 10,
                        fill: "var(--success)",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={marker.color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: marker.color, stroke: "var(--canvas)", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-xs text-muted-soft italic">
            Une seule mesure — pas encore de courbe d&apos;évolution.
          </div>
        )}

        {/* Table historique (intégrée dans le même bloc) */}
        <div className="overflow-x-auto border-t border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-muted-soft uppercase tracking-wider bg-canvas-soft">
                <th className="py-2.5 px-5 font-medium">Date</th>
                <th className="py-2.5 px-5 font-medium text-right">Valeur</th>
                <th className="py-2.5 px-5 font-medium text-right">Δ</th>
                <th className="py-2.5 px-5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const prev = records[i + 1];
                const delta = prev ? r.value - prev.value : null;
                const rowStatus = getMarkerStatus(r.value, marker);
                const rowColor = getStatusColor(rowStatus);
                return (
                  <tr key={i} className="border-t border-hairline-soft hover:bg-canvas-soft">
                    <td className="py-2.5 px-5 text-body">
                      {formatDateFr(r.recorded_at)}
                    </td>
                    <td className="py-2.5 px-5 text-right">
                      <span
                        className="tabular font-medium"
                        style={{ color: rowColor }}
                      >
                        {formatValue(r.value)}
                      </span>{" "}
                      <span className="text-[10px] text-muted">{r.unit}</span>
                    </td>
                    <td className="py-2.5 px-5 text-right">
                      {delta != null ? (
                        <DeltaCell delta={delta} marker={marker} />
                      ) : (
                        <span className="text-muted-soft text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-5 text-xs">
                      {r.source ? (
                        <Link
                          href={`/documents/${r.source.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:text-primary-deep"
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{r.source.title}</span>
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
  if (m.target_min != null && m.target_max != null)
    return `${m.target_min} – ${m.target_max} ${m.unit}`;
  if (m.target_max != null) return `≤ ${m.target_max} ${m.unit}`;
  if (m.target_min != null) return `≥ ${m.target_min} ${m.unit}`;
  return "non définie";
}
