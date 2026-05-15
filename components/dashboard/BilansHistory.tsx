"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  TestTube,
  FileText,
  User,
} from "lucide-react";
import { formatDateFr } from "@/lib/dates";
import type { MarkerDef } from "@/lib/cancer-profiles";

interface BilanRecord {
  marker_name: string;
  value: number;
  unit: string;
  alert_level: string | null;
  source_document_id: string | null;
}

interface BilanGroup {
  date: string;
  records: BilanRecord[];
  source_document?: {
    id: string;
    title: string;
    doctor_name: string | null;
  } | null;
}

interface Props {
  bilans: BilanGroup[];
  markers: Record<string, MarkerDef>;
}

/**
 * Historique des bilans biologiques groupés par date.
 * Inspiré du pattern Health-dashboard : liste de bilans avec expand pour voir
 * toutes les valeurs. Chaque bilan affiche son nb de marqueurs + lien vers le
 * document source si l'extraction vient d'une analyse Claude.
 */
export default function BilansHistory({ bilans, markers }: Props) {
  if (bilans.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-medium text-ink border-b border-hairline pb-2">
        Historique des bilans
      </h2>
      <ul className="space-y-2">
        {bilans.map((b) => (
          <BilanItem key={b.date} bilan={b} markers={markers} />
        ))}
      </ul>
    </section>
  );
}

function BilanItem({ bilan, markers }: { bilan: BilanGroup; markers: Record<string, MarkerDef> }) {
  const [open, setOpen] = useState(false);
  const counts = {
    normal: bilan.records.filter((r) => r.alert_level === "normal").length,
    warning: bilan.records.filter((r) => r.alert_level === "warning").length,
    critical: bilan.records.filter((r) => r.alert_level === "critical").length,
  };

  return (
    <li className="rounded-lg border border-hairline bg-surface-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-canvas-soft transition-colors text-left"
      >
        <TestTube className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">{formatDateFr(bilan.date)}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs text-muted">
              {bilan.records.length} marqueur{bilan.records.length > 1 ? "s" : ""}
            </span>
            {counts.critical > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error">
                {counts.critical} critique{counts.critical > 1 ? "s" : ""}
              </span>
            )}
            {counts.warning > 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                {counts.warning} attention
              </span>
            )}
            {counts.normal > 0 && counts.critical === 0 && counts.warning === 0 && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success">
                Tout normal
              </span>
            )}
            {bilan.source_document?.doctor_name && (
              <span className="text-xs text-muted inline-flex items-center gap-1">
                <User className="w-3 h-3" />
                {bilan.source_document.doctor_name}
              </span>
            )}
          </div>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-hairline space-y-2 bg-canvas-soft">
          {bilan.source_document && (
            <Link
              href={`/documents/${bilan.source_document.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-deep"
            >
              <FileText className="w-3.5 h-3.5" />
              {bilan.source_document.title}
            </Link>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-2 font-normal">Marqueur</th>
                <th className="py-1 pr-2 font-normal text-right">Valeur</th>
                <th className="py-1 pr-2 font-normal">Plage cible</th>
              </tr>
            </thead>
            <tbody>
              {bilan.records.map((r, i) => {
                const def = markers[r.marker_name];
                const label = def?.label ?? r.marker_name;
                const range = def
                  ? formatRange(def)
                  : "—";
                const color =
                  r.alert_level === "critical"
                    ? "var(--error)"
                    : r.alert_level === "warning"
                      ? "var(--warning)"
                      : "var(--ink)";
                return (
                  <tr key={i} className="border-t border-hairline-soft">
                    <td className="py-1.5 pr-2 text-body">{label}</td>
                    <td
                      className="py-1.5 pr-2 text-right tabular font-medium"
                      style={{ color }}
                    >
                      {r.value} <span className="text-muted text-[10px]">{r.unit}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-muted text-[11px]">{range}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

function formatRange(m: MarkerDef): string {
  if (m.target_min != null && m.target_max != null) return `${m.target_min}–${m.target_max} ${m.unit}`;
  if (m.target_max != null) return `≤ ${m.target_max} ${m.unit}`;
  if (m.target_min != null) return `≥ ${m.target_min} ${m.unit}`;
  return "—";
}
