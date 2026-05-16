/**
 * Module Symptômes : types + helpers (catégories, wellbeing, formatage).
 */

export type SymptomCategory =
  | "digestive"
  | "neurological"
  | "cardiovascular"
  | "general"
  | "psychological"
  | "skin"
  | "musculoskeletal"
  | "respiratory"
  | "vital_sign"
  | "wellbeing"
  | "other";

export interface SymptomLog {
  id: string;
  family_id: string;
  logged_at: string;
  logged_by: string | null;
  category: SymptomCategory | null;
  symptom_type: string | null;
  symptom_label: string | null;
  severity: number | null;
  numeric_value: number | null;
  numeric_value_2: number | null;
  numeric_unit: string | null;
  wellbeing_score: number | null;
  duration_minutes: number | null;
  context: string[] | null;
  linked_medication_id: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  is_critical: boolean;
  red_flag_matched: string | null;
  matched_keywords: string[] | null;
  notes: string | null;
}

export const SYMPTOM_CATEGORIES: Record<SymptomCategory, { label: string; color: string }> = {
  digestive: { label: "Digestif", color: "#f97316" },
  neurological: { label: "Neurologique", color: "#8b5cf6" },
  cardiovascular: { label: "Cardiovasculaire", color: "#ef4444" },
  general: { label: "Général", color: "#64748b" },
  psychological: { label: "Psychologique", color: "#a855f7" },
  skin: { label: "Cutané", color: "#f59e0b" },
  musculoskeletal: { label: "Musculo-squelettique", color: "#0ea5e9" },
  respiratory: { label: "Respiratoire", color: "#06b6d4" },
  vital_sign: { label: "Signe vital", color: "#10b981" },
  wellbeing: { label: "Bien-être", color: "#22c55e" },
  other: { label: "Autre", color: "#94a3b8" },
};

export interface WellbeingLevel {
  score: 1 | 2 | 3 | 4 | 5;
  emoji: string;
  label: string;
  color: string;
}

export const WELLBEING_LEVELS: WellbeingLevel[] = [
  { score: 1, emoji: "🚨", label: "Urgence", color: "#dc2626" },
  { score: 2, emoji: "😟", label: "Pas bien", color: "#f97316" },
  { score: 3, emoji: "😐", label: "Moyen", color: "#f59e0b" },
  { score: 4, emoji: "🙂", label: "Bien", color: "#22c55e" },
  { score: 5, emoji: "😀", label: "Très bien", color: "#10b981" },
];

export function getWellbeingMeta(score: number | null): WellbeingLevel | null {
  if (!score) return null;
  return WELLBEING_LEVELS.find((w) => w.score === score) ?? null;
}

/** Code couleur pour la sévérité 0-10. */
export function severityColor(severity: number | null): string {
  if (severity == null) return "#64748b";
  if (severity >= 8) return "#dc2626";
  if (severity >= 5) return "#f97316";
  if (severity >= 3) return "#f59e0b";
  return "#22c55e";
}

/** Contextes courants en français (multi-select dans le form détaillé). */
export const SYMPTOM_CONTEXTS = [
  { value: "morning", label: "Matin" },
  { value: "afternoon", label: "Après-midi" },
  { value: "evening", label: "Soir" },
  { value: "night", label: "Nuit" },
  { value: "after_meal", label: "Après repas" },
  { value: "fasting", label: "À jeun" },
  { value: "after_medication", label: "Après médicament" },
  { value: "after_effort", label: "Après effort" },
  { value: "stress", label: "Stress" },
];

/** Préréglages pour les signes vitaux. */
export interface VitalSignPreset {
  type: string;
  label: string;
  unit: string;
  fields: 1 | 2; // 1 pour les mesures simples, 2 pour TA (sys/dia)
  minRange?: [number, number];
  maxRange?: [number, number];
}

export const VITAL_SIGNS: VitalSignPreset[] = [
  {
    type: "tension_arterielle",
    label: "Tension artérielle",
    unit: "mmHg",
    fields: 2,
    minRange: [80, 50],
    maxRange: [180, 110],
  },
  {
    type: "frequence_cardiaque",
    label: "Fréquence cardiaque",
    unit: "bpm",
    fields: 1,
  },
  {
    type: "temperature",
    label: "Température",
    unit: "°C",
    fields: 1,
  },
  {
    type: "poids",
    label: "Poids",
    unit: "kg",
    fields: 1,
  },
  {
    type: "saturation_o2",
    label: "Saturation O₂",
    unit: "%",
    fields: 1,
  },
];

export function vitalSignFromType(t: string): VitalSignPreset | null {
  return VITAL_SIGNS.find((v) => v.type === t) ?? null;
}
