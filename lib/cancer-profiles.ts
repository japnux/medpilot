/**
 * Profils cancer préconfigurés.
 *
 * Chaque profil définit :
 * - les marqueurs biologiques pertinents avec leurs cibles thérapeutiques
 *   et leurs seuils d'alerte (champs target_min/max et alert_min/max)
 * - le calendrier de surveillance standard
 * - le réseau de référence national
 *
 * Contribution communautaire : voir README.md → "Ajouter un profil cancer".
 */

export interface MarkerDef {
  /** Libellé affiché (FR). */
  label: string;
  /** Unité de mesure (mg/L, nmol/L, etc.). */
  unit: string;
  /** Borne basse de la zone thérapeutique cible (null = pas de minimum). */
  target_min?: number | null;
  /** Borne haute de la zone thérapeutique cible (null = pas de maximum). */
  target_max?: number | null;
  /** Borne basse de la zone d'alerte (en-dessous = critical). */
  alert_min?: number | null;
  /** Borne haute de la zone d'alerte (au-dessus = critical). */
  alert_max?: number | null;
  /** Couleur Recharts (palette MedPilot). */
  color: string;
  /** Description / contexte clinique. */
  description?: string;
}

export interface SurveillanceItem {
  /** Libellé de l'examen ("Scanner TAP", "Mitotanémie", etc.). */
  label: string;
  /** Type d'alerte associé (clé interne pour insertion en BDD). */
  alert_type: string;
  /** Périodicité en mois. */
  frequency_months: number;
  /** Année de début (1 = dès le diagnostic). */
  from_year?: number;
  /** Nombre d'années à appliquer cette périodicité. */
  years?: number;
}

export interface CancerProfile {
  /** Libellé affiché. */
  label: string;
  /** Code CIM-10 (informatif). */
  icd10: string | null;
  /** Réseau de référence national pour orientation. */
  reference_network: string | null;
  /** Marqueurs biologiques (clé = nom interne, value = MarkerDef). */
  markers: Record<string, MarkerDef>;
  /** Calendrier de surveillance recommandé. */
  surveillance_schedule: SurveillanceItem[];
}

export const CANCER_PROFILES: Record<string, CancerProfile> = {
  // -------------------------------------------------------------------
  // Corticosurrénalome : cancer rare de la corticosurrénale.
  // Marqueurs et zones cibles inspirés des recommandations ENDOCAN-COMETE
  // et ESE/ENSAT (mitotane zone thérapeutique 14-20 mg/L).
  // -------------------------------------------------------------------
  corticosurrenalome: {
    label: "Corticosurrénalome",
    icd10: "C74.0",
    reference_network: "ENDOCAN-COMETE",
    markers: {
      mitotane: {
        label: "Mitotanémie",
        unit: "mg/L",
        target_min: 14,
        target_max: 20,
        alert_min: 10,
        alert_max: 25,
        color: "#6366f1",
        description: "Zone thérapeutique cible : 14-20 mg/L",
      },
      cortisol: {
        label: "Cortisol",
        unit: "nmol/L",
        target_min: 100,
        target_max: 500,
        alert_min: 50,
        alert_max: null,
        color: "#f59e0b",
        description: "Surveillance insuffisance surrénalienne sous mitotane",
      },
      acth: {
        label: "ACTH",
        unit: "pg/mL",
        target_min: 7,
        target_max: 63,
        color: "#10b981",
        description: "Axe corticotrope",
      },
      dhea_s: {
        label: "DHEA-S",
        unit: "µmol/L",
        color: "#8b5cf6",
        description: "Marqueur surrénalien",
      },
      sodium: {
        label: "Natrémie",
        unit: "mmol/L",
        target_min: 135,
        target_max: 145,
        alert_min: 130,
        alert_max: 150,
        color: "#3b82f6",
      },
      potassium: {
        label: "Kaliémie",
        unit: "mmol/L",
        target_min: 3.5,
        target_max: 5.0,
        alert_min: 3.0,
        alert_max: 5.5,
        color: "#ec4899",
      },
      alat: {
        label: "ALAT",
        unit: "UI/L",
        target_max: 40,
        alert_max: 120,
        color: "#f97316",
        description: "Hépatotoxicité mitotane",
      },
      asat: {
        label: "ASAT",
        unit: "UI/L",
        target_max: 40,
        alert_max: 120,
        color: "#ef4444",
        description: "Hépatotoxicité mitotane",
      },
      cholesterol: {
        label: "Cholestérol total",
        unit: "g/L",
        target_max: 2.0,
        alert_max: 3.0,
        color: "#84cc16",
        description: "Hypercholestérolémie fréquente sous mitotane",
      },
      ldl: {
        label: "LDL",
        unit: "g/L",
        target_max: 1.6,
        alert_max: 2.5,
        color: "#06b6d4",
      },
    },
    surveillance_schedule: [
      { label: "Scanner TAP", alert_type: "scanner_tap", frequency_months: 3, from_year: 1, years: 2 },
      { label: "Scanner TAP", alert_type: "scanner_tap", frequency_months: 6, from_year: 3, years: 3 },
      { label: "Bilan biologique complet", alert_type: "biologie_mensuelle", frequency_months: 1, years: 5 },
      { label: "Mitotanémie", alert_type: "mitotanemie", frequency_months: 1, years: 5 },
    ],
  },

  // -------------------------------------------------------------------
  // Cancer du sein (profil minimal, à enrichir par PR communautaire).
  // -------------------------------------------------------------------
  breast_cancer: {
    label: "Cancer du sein",
    icd10: "C50",
    reference_network: "UNICANCER",
    markers: {
      ca153: {
        label: "CA 15-3",
        unit: "U/mL",
        target_max: 30,
        alert_max: 60,
        color: "#ec4899",
        description: "Marqueur tumoral spécifique du cancer du sein",
      },
      cea: {
        label: "ACE",
        unit: "ng/mL",
        target_max: 5,
        alert_max: 15,
        color: "#f59e0b",
      },
    },
    surveillance_schedule: [
      { label: "Mammographie", alert_type: "mammographie", frequency_months: 12, years: 5 },
      { label: "Consultation oncologie", alert_type: "consult_onco", frequency_months: 3, years: 2 },
      { label: "Consultation oncologie", alert_type: "consult_onco", frequency_months: 6, from_year: 3, years: 3 },
    ],
  },

  // -------------------------------------------------------------------
  // Profil personnalisé : l'utilisateur définit ses propres marqueurs
  // à l'onboarding (stockés dans cancer_profiles.custom_markers).
  // -------------------------------------------------------------------
  custom: {
    label: "Autre cancer (personnalisé)",
    icd10: null,
    reference_network: null,
    markers: {},
    surveillance_schedule: [],
  },
};

/** Liste plate pour les dropdowns d'onboarding. */
export const CANCER_PROFILE_OPTIONS = Object.entries(CANCER_PROFILES).map(
  ([key, profile]) => ({
    value: key,
    label: profile.label,
  })
);
