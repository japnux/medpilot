/**
 * Mapping tabs → sections de la veille proactive.
 * Symétrique de lib/knowledge-sections.ts pour la fiche cancer.
 */
import type { WatchFindingResult } from "./watch-prompts";

export type WatchTabId = "synthese" | "actions" | "reseau" | "publications";

export type WatchSectionId =
  | "executive_summary"
  | "top_priorities"
  | "contextual_alerts"
  | "clinical_trials"
  | "expert_centers"
  | "patient_resources"
  | "publications";

export interface WatchTab {
  id: WatchTabId;
  label: string;
  sections: WatchSectionId[];
}

export const WATCH_TABS: WatchTab[] = [
  {
    id: "synthese",
    label: "Synthèse",
    sections: ["executive_summary", "top_priorities"],
  },
  {
    id: "actions",
    label: "Actions à mener",
    sections: ["contextual_alerts", "clinical_trials"],
  },
  {
    id: "reseau",
    label: "Réseau & ressources",
    sections: ["expert_centers", "patient_resources"],
  },
  {
    id: "publications",
    label: "Publications",
    sections: ["publications"],
  },
];

/** Compte total d'items dans un tab. */
export function getTabItemCount(tabId: WatchTabId, f: WatchFindingResult): number {
  switch (tabId) {
    case "synthese":
      return f.top_priorities?.length ?? 0;
    case "actions":
      return (f.contextual_alerts?.length ?? 0) + (f.clinical_trials?.length ?? 0);
    case "reseau":
      return (f.expert_centers?.length ?? 0) + (f.patient_resources?.length ?? 0);
    case "publications":
      return f.publications?.length ?? 0;
  }
}

export function getCriticalAlertsCount(f: WatchFindingResult): number {
  return (f.contextual_alerts ?? []).filter((a) => a.severity === "critical").length;
}
