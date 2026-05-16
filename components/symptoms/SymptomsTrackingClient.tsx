"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  WELLBEING_LEVELS,
  SYMPTOM_CATEGORIES,
  getWellbeingMeta,
  severityColor,
  type SymptomLog,
} from "@/lib/symptoms";
import {
  AlertTriangle,
  CheckCircle,
  GitBranch,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";

interface Props {
  familyId: string;
  symptoms: SymptomLog[];
}

const PERIOD_OPTIONS: { id: 7 | 14 | 30 | 90; label: string }[] = [
  { id: 7, label: "7 jours" },
  { id: 14, label: "14 jours" },
  { id: 30, label: "30 jours" },
  { id: 90, label: "90 jours" },
];

/**
 * Tracking + historique. Affiche en haut un bandeau critique non résolu,
 * puis :
 *  - une courbe simple wellbeing par jour (SVG, sans Recharts pour limiter
 *    le bundle)
 *  - les top symptômes par fréquence
 *  - l'historique groupé par check-in (logged_at agrégé)
 */
export default function SymptomsTrackingClient({ familyId, symptoms }: Props) {
  void familyId;
  const router = useRouter();
  const [period, setPeriod] = useState<7 | 14 | 30 | 90>(14);
  const [filterCat, setFilterCat] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    const since = Date.now() - period * 86_400_000;
    return symptoms.filter((s) => new Date(s.logged_at).getTime() >= since);
  }, [symptoms, period]);

  const wellbeingPoints = useMemo(() => {
    return aggregateWellbeing(filtered, period);
  }, [filtered, period]);

  const topSymptoms = useMemo(() => {
    const map = new Map<string, { label: string; count: number; avgSev: number | null }>();
    for (const s of filtered) {
      if (!s.symptom_label || s.category === "wellbeing") continue;
      const g = map.get(s.symptom_label) ?? {
        label: s.symptom_label,
        count: 0,
        avgSev: null,
      };
      g.count++;
      if (typeof s.severity === "number") {
        const all = map.get(s.symptom_label);
        // running average via storage in tmp arrays — simpler : recompute below
        void all;
      }
      map.set(s.symptom_label, g);
    }
    // Recompute avg severity properly
    for (const label of map.keys()) {
      const sevs = filtered
        .filter((s) => s.symptom_label === label && typeof s.severity === "number")
        .map((s) => s.severity as number);
      if (sevs.length > 0) {
        const m = map.get(label)!;
        m.avgSev = Math.round(sevs.reduce((a, b) => a + b, 0) / sevs.length);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filtered]);

  const historyFiltered = useMemo(() => {
    if (filterCat === "all") return filtered;
    return filtered.filter((s) => s.category === filterCat);
  }, [filtered, filterCat]);

  const criticalsUnresolved = symptoms.filter(
    (s) => s.is_critical && !s.is_resolved,
  );

  async function resolveSymptom(id: string) {
    await fetch(`/api/symptoms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_resolved: true }),
    });
    router.refresh();
  }

  async function deleteSymptom(id: string, label: string | null) {
    if (
      !confirm(
        `Supprimer définitivement « ${label ?? "ce symptôme"} » ?\nL'action est irréversible.`,
      )
    )
      return;
    await fetch(`/api/symptoms/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink">Symptômes</h1>
          <p className="text-sm text-muted mt-1">
            {symptoms.length > 0
              ? `${symptoms.length} entrée${symptoms.length > 1 ? "s" : ""} au total`
              : "Aucun symptôme enregistré pour le moment"}
          </p>
        </div>
        <Link
          href="/symptoms/log"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md bg-ink text-canvas text-sm hover:bg-ink/90 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Check-in
        </Link>
      </header>

      {criticalsUnresolved.length > 0 && (
        <section className="rounded-lg border-2 border-error/50 bg-error/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-error">
                {criticalsUnresolved.length} symptôme
                {criticalsUnresolved.length > 1 ? "s" : ""} critique
                {criticalsUnresolved.length > 1 ? "s" : ""} non résolu
                {criticalsUnresolved.length > 1 ? "s" : ""}
              </p>
              <ul className="mt-2 space-y-2">
                {criticalsUnresolved.slice(0, 3).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-body-strong">{s.symptom_label}</p>
                      <p className="text-xs text-muted">
                        {new Date(s.logged_at).toLocaleString("fr-FR")}
                        {s.red_flag_matched
                          ? ` · Red flag : ${s.red_flag_matched}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resolveSymptom(s.id)}
                      className="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-success/40 text-success hover:bg-success/10"
                    >
                      <CheckCircle className="w-3 h-3" /> Résolu
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <a
                  href="tel:15"
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-error text-canvas"
                >
                  <Phone className="w-3 h-3" /> 15
                </a>
                <a
                  href="tel:112"
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-error text-error"
                >
                  <Phone className="w-3 h-3" /> 112
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Période */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted mr-1">Période :</span>
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              period === p.id
                ? "border-ink bg-ink text-canvas"
                : "border-hairline text-body hover:bg-surface-card"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Wellbeing chart */}
      {wellbeingPoints.length > 0 && (
        <section className="rounded-xl border border-hairline bg-surface-card p-4">
          <h2 className="text-sm font-medium text-ink mb-3">
            Bien-être global sur {period} jours
          </h2>
          <WellbeingSparkline points={wellbeingPoints} />
        </section>
      )}

      {/* Top symptômes */}
      {topSymptoms.length > 0 && (
        <section className="rounded-xl border border-hairline bg-surface-card p-4">
          <h2 className="text-sm font-medium text-ink mb-3">
            Symptômes principaux ({topSymptoms.length})
          </h2>
          <ul className="space-y-2">
            {topSymptoms.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-ink">{s.label}</span>
                  <span className="text-xs text-muted">×{s.count}</span>
                </div>
                {s.avgSev !== null && (
                  <span
                    className="text-xs font-medium"
                    style={{ color: severityColor(s.avgSev) }}
                  >
                    ~{s.avgSev}/10
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filtres + historique */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-medium text-ink">Historique</h2>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-xs border border-hairline rounded-md px-2 py-1 bg-canvas"
          >
            <option value="all">Toutes catégories</option>
            {Object.entries(SYMPTOM_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {historyFiltered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-canvas-soft p-8 text-center">
            <GitBranch className="w-8 h-8 mx-auto text-muted-soft mb-2" />
            <p className="text-sm text-muted italic">
              Aucun symptôme sur cette période.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {historyFiltered.map((s) => (
              <SymptomItem
                key={s.id}
                symptom={s}
                onDelete={() => deleteSymptom(s.id, s.symptom_label)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SymptomItem({
  symptom: s,
  onDelete,
}: {
  symptom: SymptomLog;
  onDelete: () => void;
}) {
  const isWellbeing = s.category === "wellbeing";
  const isVital = s.category === "vital_sign";
  const wbMeta = getWellbeingMeta(s.wellbeing_score);
  const catMeta = s.category
    ? SYMPTOM_CATEGORIES[s.category as keyof typeof SYMPTOM_CATEGORIES]
    : null;

  return (
    <li
      className={`rounded-lg border p-3 ${
        s.is_critical && !s.is_resolved
          ? "border-error/40 bg-error/5"
          : "border-hairline bg-surface-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-xs text-muted">
              {new Date(s.logged_at).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {catMeta && (
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  color: catMeta.color,
                  backgroundColor: `${catMeta.color}1a`,
                  border: `1px solid ${catMeta.color}40`,
                }}
              >
                {catMeta.label}
              </span>
            )}
            {s.is_critical && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/30">
                <AlertTriangle className="w-3 h-3" />
                Critique
              </span>
            )}
            {s.is_resolved && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success">
                <CheckCircle className="w-3 h-3" /> Résolu
              </span>
            )}
          </div>

          {isWellbeing ? (
            <p className="text-sm text-ink">
              {wbMeta ? (
                <span>
                  {wbMeta.emoji} <span className="font-medium">{wbMeta.label}</span>
                </span>
              ) : (
                "Check-in"
              )}
            </p>
          ) : isVital ? (
            <p className="text-sm text-ink">
              <span className="font-medium">{s.symptom_label}</span> :{" "}
              {s.numeric_value_2 != null
                ? `${s.numeric_value} / ${s.numeric_value_2}`
                : s.numeric_value}{" "}
              <span className="text-muted">{s.numeric_unit}</span>
            </p>
          ) : (
            <p className="text-sm text-ink">
              <span className="font-medium">{s.symptom_label}</span>
              {typeof s.severity === "number" && (
                <span
                  className="ml-2 text-xs font-medium"
                  style={{ color: severityColor(s.severity) }}
                >
                  {s.severity}/10
                </span>
              )}
            </p>
          )}
          {s.notes && (
            <p className="text-xs text-muted italic mt-1">« {s.notes} »</p>
          )}
          {s.red_flag_matched && (
            <p className="text-xs text-error mt-1">
              Red flag : {s.red_flag_matched}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          title="Supprimer ce symptôme"
          aria-label="Supprimer ce symptôme"
          className="shrink-0 w-7 h-7 rounded-md text-muted hover:text-error hover:bg-error/5 flex items-center justify-center"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

interface WellbeingPoint {
  day: string;
  avg: number;
}

function aggregateWellbeing(
  symptoms: SymptomLog[],
  daysBack: number,
): WellbeingPoint[] {
  const byDay = new Map<string, number[]>();
  for (const s of symptoms) {
    if (typeof s.wellbeing_score !== "number") continue;
    const day = s.logged_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(s.wellbeing_score);
    byDay.set(day, arr);
  }
  const today = new Date();
  const points: WellbeingPoint[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const scores = byDay.get(key);
    if (scores && scores.length > 0) {
      points.push({
        day: key,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      });
    }
  }
  return points;
}

function WellbeingSparkline({ points }: { points: WellbeingPoint[] }) {
  if (points.length === 0) return null;
  const width = 600;
  const height = 80;
  const padX = 8;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const x = (i: number) =>
    padX + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  // Normalize : 1 (en bas) → 5 (en haut)
  const y = (v: number) => padY + innerH * (1 - (v - 1) / 4);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.avg)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-20"
      preserveAspectRatio="none"
    >
      {/* Grid */}
      {[1, 2, 3, 4, 5].map((v) => (
        <line
          key={v}
          x1={padX}
          x2={width - padX}
          y1={y(v)}
          y2={y(v)}
          stroke="#e2e8f0"
          strokeWidth={0.5}
        />
      ))}
      <path d={path} fill="none" stroke="#22c55e" strokeWidth={2} />
      {points.map((p, i) => {
        const meta = WELLBEING_LEVELS.find(
          (w) => w.score === Math.round(p.avg),
        );
        return (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.avg)}
            r={3}
            fill={meta?.color ?? "#22c55e"}
          />
        );
      })}
    </svg>
  );
}
