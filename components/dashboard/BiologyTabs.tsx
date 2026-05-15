"use client";

import { useState } from "react";
import { Sparkles, Activity, History } from "lucide-react";
import type { MarkerDef } from "@/lib/cancer-profiles";
import BiologyTrendsCard from "./BiologyTrendsCard";
import MarkersByCategory from "./MarkersByCategory";
import BilansHistory from "./BilansHistory";

type Tab = "trends" | "markers" | "history";

interface BilanGroup {
  date: string;
  records: Array<{
    marker_name: string;
    value: number;
    unit: string;
    alert_level: string | null;
    source_document_id: string | null;
  }>;
  source_document?: {
    id: string;
    title: string;
    doctor_name: string | null;
  } | null;
}

interface Props {
  familyId: string;
  markers: Record<string, MarkerDef>;
  byMarker: Record<
    string,
    Array<{ recorded_at: string; value: number; alert_level: string | null }>
  >;
  bilans: BilanGroup[];
}

const TABS: Array<{ key: Tab; label: string; icon: typeof Sparkles }> = [
  { key: "trends", label: "Tendances", icon: Sparkles },
  { key: "markers", label: "Marqueurs", icon: Activity },
  { key: "history", label: "Historique", icon: History },
];

export default function BiologyTabs({ familyId, markers, byMarker, bilans }: Props) {
  const [tab, setTab] = useState<Tab>("trends");

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <nav className="flex gap-1 border-b border-hairline">
        {TABS.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
                active
                  ? "border-primary text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Contenu */}
      {tab === "trends" && <BiologyTrendsCard familyId={familyId} />}
      {tab === "markers" && (
        <MarkersByCategory markers={markers} byMarker={byMarker} />
      )}
      {tab === "history" && <BilansHistory bilans={bilans} markers={markers} />}
    </div>
  );
}
