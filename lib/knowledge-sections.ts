/**
 * Mapping tabs → sections de la knowledge base.
 * Détermine quel onglet contient quelle section, et l'ordre d'affichage.
 */
import type { CancerKnowledge } from "./knowledge-prompts";

export type TabId = "essentiel" | "medical" | "surveillance" | "recherche";

export type SectionId =
  | "overview"
  | "expert_network"
  | "key_questions_for_team"
  | "staging_classification"
  | "biomarkers"
  | "standard_protocols"
  | "side_effects_to_monitor"
  | "surveillance_recommendations"
  | "genetic_considerations"
  | "clinical_trials_landscape"
  | "patient_resources";

export interface KnowledgeTab {
  id: TabId;
  label: string;
  sections: SectionId[];
}

export const KNOWLEDGE_TABS: KnowledgeTab[] = [
  {
    id: "essentiel",
    label: "Essentiel",
    sections: ["overview", "expert_network", "key_questions_for_team"],
  },
  {
    id: "medical",
    label: "Médical",
    sections: [
      "staging_classification",
      "biomarkers",
      "standard_protocols",
      "side_effects_to_monitor",
    ],
  },
  {
    id: "surveillance",
    label: "Surveillance",
    sections: ["surveillance_recommendations", "genetic_considerations"],
  },
  {
    id: "recherche",
    label: "Recherche & options",
    sections: ["clinical_trials_landscape", "patient_resources"],
  },
];

/** Calcule le nombre d'items pour une section donnée. */
export function getSectionCount(sectionId: SectionId, kb: CancerKnowledge): number | null {
  switch (sectionId) {
    case "overview":
    case "staging_classification":
    case "surveillance_recommendations":
    case "genetic_considerations":
      return null;
    case "expert_network":
      return kb.expert_network.length;
    case "key_questions_for_team":
      return kb.key_questions_for_team.length;
    case "biomarkers":
      return kb.biomarkers.length;
    case "standard_protocols":
      return kb.standard_protocols.length;
    case "side_effects_to_monitor":
      return kb.side_effects_to_monitor.length;
    case "clinical_trials_landscape":
      return kb.clinical_trials_landscape.length;
    case "patient_resources":
      return kb.patient_resources.length;
  }
}

/** Somme des counts d'un tab. */
export function getTabCount(tab: KnowledgeTab, kb: CancerKnowledge): number {
  return tab.sections.reduce((sum, s) => {
    const n = getSectionCount(s, kb);
    return sum + (n ?? 0);
  }, 0);
}
