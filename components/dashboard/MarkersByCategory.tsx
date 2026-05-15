"use client";

import { useState } from "react";
import type { MarkerDef } from "@/lib/cancer-profiles";
import {
  categorizeMarker,
  getActiveCategories,
  type MarkerCategoryKey,
} from "@/lib/marker-categories";
import MarkerRow from "./MarkerRow";

interface Props {
  markers: Record<string, MarkerDef>;
  /** records groupés par marker_name, triés par date desc. */
  byMarker: Record<
    string,
    Array<{ recorded_at: string; value: number; alert_level: string | null }>
  >;
}

/**
 * Affichage compact des marqueurs biologiques, organisé par catégorie via des
 * onglets pills. Pattern Health-dashboard.
 */
export default function MarkersByCategory({ markers, byMarker }: Props) {
  // Filtrer aux markers ayant au moins une mesure
  const activeMarkers = Object.entries(markers).filter(
    ([key]) => (byMarker[key]?.length ?? 0) > 0,
  );
  const activeNames = activeMarkers.map(([key]) => key);
  const categories = getActiveCategories(activeNames);

  const [activeCategory, setActiveCategory] = useState<MarkerCategoryKey>(
    categories[0]?.key ?? "autres",
  );

  if (activeMarkers.length === 0) return null;

  const filtered = activeMarkers.filter(
    ([key]) => categorizeMarker(key) === activeCategory,
  );

  return (
    <section className="card-feature p-0 overflow-hidden">
      {/* Header tabs */}
      <header className="px-4 pt-4 pb-3 border-b border-hairline">
        <p className="text-[10px] uppercase tracking-wider text-muted-soft font-medium mb-3">
          Analyse par catégorie
        </p>
        <nav className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
          {categories.map((c) => {
            const active = c.key === activeCategory;
            return (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-canvas-soft text-body hover:bg-surface-strong"
                }`}
              >
                <span aria-hidden>{c.emoji}</span>
                {c.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Rows */}
      <div className="py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-soft italic text-center py-6">
            Aucun marqueur dans cette catégorie.
          </p>
        ) : (
          filtered.map(([key, marker]) => (
            <MarkerRow
              key={key}
              markerKey={key}
              marker={marker}
              records={(byMarker[key] ?? []).map((r) => ({
                recorded_at: r.recorded_at,
                value: r.value,
              }))}
            />
          ))
        )}
      </div>
    </section>
  );
}
