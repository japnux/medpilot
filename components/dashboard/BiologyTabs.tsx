"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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

function isValidTab(v: string | null): v is Tab {
  return v === "trends" || v === "markers" || v === "history";
}

export default function BiologyTabs({ familyId, markers, byMarker, bilans }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(isValidTab(urlTab) ? urlTab : "trends");

  // Sync URL → state quand on clique un sous-menu sidebar
  useEffect(() => {
    if (isValidTab(urlTab) && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  function selectTab(t: Tab) {
    setTab(t);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", t);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      {/* Onglets (segmented control) */}
      <nav className="inline-flex flex-wrap bg-canvas-soft border border-hairline rounded-lg p-1 gap-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                active
                  ? "bg-canvas text-ink shadow-sm"
                  : "text-muted hover:text-ink"
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
