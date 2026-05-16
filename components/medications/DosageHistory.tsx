"use client";

import { ArrowRight, ChevronDown, ChevronRight, History } from "lucide-react";
import { useState } from "react";
import type { DosageChangeRow } from "@/lib/medication-dosage-helpers";
import { formatDateFR } from "@/lib/medications-helpers";

interface Props {
  changes: DosageChangeRow[];
}

/**
 * Historique des changements de dose d'un médicament. Repliée par défaut,
 * affiche les changements du plus récent au plus ancien avec l'avant/après,
 * la raison, le prescripteur et la date.
 */
export default function DosageHistory({ changes }: Props) {
  const [open, setOpen] = useState(false);
  if (changes.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-body hover:text-ink"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <History className="w-3.5 h-3.5 text-muted" />
        Historique des doses ({changes.length})
      </button>
      {open && (
        <ul className="mt-2 ml-5 space-y-2 border-l border-hairline pl-3">
          {changes.map((c) => (
            <li key={c.id} className="text-xs">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-muted">
                  {formatDateFR(c.changed_at)}
                </span>
                <span className="inline-flex items-center gap-1 text-body-strong">
                  <span>{c.previous_dosage ?? "—"}</span>
                  <ArrowRight className="w-3 h-3 text-muted" />
                  <span>{c.new_dosage}</span>
                </span>
              </div>
              {c.reason && (
                <p className="text-muted italic mt-0.5">« {c.reason} »</p>
              )}
              {(c.prescriber || c.new_posology) && (
                <p className="text-muted mt-0.5">
                  {c.prescriber ? `Prescrit par ${c.prescriber}` : ""}
                  {c.prescriber && c.new_posology ? " · " : ""}
                  {c.new_posology ? `Posologie : ${c.new_posology}` : ""}
                </p>
              )}
              {c.notes && <p className="text-muted mt-0.5">{c.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
