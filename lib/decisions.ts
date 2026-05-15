/**
 * Module Décisions : types partagés client/serveur + helpers d'affichage.
 *
 * Une décision = un choix à trancher (inclusion essai, traitement A vs B,
 * 2e avis, ajustement dose…) avec son statut, ses options évaluées et sa
 * traçabilité vers le document ou la consultation source.
 */

import {
  FlaskConical,
  Pill,
  Stethoscope,
  Telescope,
  UserSearch,
  FileText,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type DecisionCategory =
  | "essai_clinique"
  | "traitement"
  | "examen"
  | "surveillance"
  | "second_avis"
  | "administratif"
  | "autre";

export type DecisionStatus = "pending" | "decided" | "abandoned" | "na";
export type DecisionPriority = "high" | "normal" | "low";

export interface DecisionOption {
  label: string;
  pros?: string[];
  cons?: string[];
  recommended?: boolean;
}

export interface DecisionRow {
  id: string;
  family_id: string;
  title: string;
  question: string | null;
  category: DecisionCategory;
  priority: DecisionPriority;
  due_date: string | null;
  options: DecisionOption[];
  status: DecisionStatus;
  decided_at: string | null;
  chosen_option: string | null;
  rationale: string | null;
  decided_by: string | null;
  source_document_id: string | null;
  source_consultation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryMeta {
  label: string;
  color: string;
  icon: LucideIcon;
}

export const DECISION_CATEGORIES: Record<DecisionCategory, CategoryMeta> = {
  essai_clinique: { label: "Essai clinique", color: "#ec4899", icon: FlaskConical },
  traitement: { label: "Traitement", color: "#06b6d4", icon: Pill },
  examen: { label: "Examen", color: "#8b5cf6", icon: Telescope },
  surveillance: { label: "Surveillance", color: "#f59e0b", icon: Stethoscope },
  second_avis: { label: "Second avis", color: "#3b82f6", icon: UserSearch },
  administratif: { label: "Administratif", color: "#94a3b8", icon: FileText },
  autre: { label: "Autre", color: "#94a3b8", icon: HelpCircle },
};

export function getCategoryMeta(c: DecisionCategory | string): CategoryMeta {
  return DECISION_CATEGORIES[c as DecisionCategory] ?? DECISION_CATEGORIES.autre;
}

export const DECIDED_BY_OPTIONS = [
  { value: "patient", label: "Patient" },
  { value: "famille", label: "Famille" },
  { value: "RCP", label: "RCP" },
  { value: "équipe médicale", label: "Équipe médicale" },
];
