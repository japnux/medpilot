/**
 * Construit le contexte patient pour le prompt de veille à partir du
 * cancer_profile en BDD. Adapté à notre schéma (cancer_label, surgery_result,
 * active_treatments jsonb, key_biomarkers jsonb, reference_network).
 */

import type { WatchPromptContext } from "./watch-prompts";

interface CareTeamEntry {
  name?: string;
  specialty?: string;
  hospital?: string;
}

interface ProfileRow {
  cancer_type: string;
  cancer_label: string;
  patient_first_name: string | null;
  patient_birth_date: string | null;
  diagnosis_date: string | null;
  stage: string | null;
  surgery_date: string | null;
  surgery_result: string | null;
  active_treatments: unknown;
  key_biomarkers: unknown;
  care_team: unknown;
  reference_network: string | null;
}

export function buildWatchContext(profile: ProfileRow): WatchPromptContext {
  const today = new Date();
  const todayDate = today.toLocaleDateString("fr-FR");

  const age = profile.patient_birth_date
    ? Math.floor(
        (today.getTime() - new Date(profile.patient_birth_date).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25),
      )
    : null;

  // Traitements : active_treatments est un jsonb [{name, start_date?, ...}]
  const treatments = Array.isArray(profile.active_treatments)
    ? (profile.active_treatments as Array<{ name?: string }>)
        .map((t) => t?.name)
        .filter((n): n is string => !!n)
    : [];

  // Caractéristiques tumorales = key_biomarkers (jsonb libre)
  const tumorCharacteristics: Record<string, string | number | null> = {};
  if (Array.isArray(profile.key_biomarkers)) {
    for (const b of profile.key_biomarkers as Array<{
      name?: string;
      label?: string;
      value?: string | number;
    }>) {
      const key = b.label ?? b.name;
      if (key) tumorCharacteristics[key] = b.value ?? null;
    }
  } else if (profile.key_biomarkers && typeof profile.key_biomarkers === "object") {
    for (const [k, v] of Object.entries(profile.key_biomarkers)) {
      if (typeof v === "string" || typeof v === "number" || v === null) {
        tumorCharacteristics[k] = v;
      }
    }
  }

  // Région : déduite du 1er hôpital de la care_team si possible
  let region = "non précisée";
  if (Array.isArray(profile.care_team)) {
    const team = profile.care_team as CareTeamEntry[];
    const firstHospital = team.find((m) => m.hospital)?.hospital;
    if (firstHospital) region = firstHospital;
  }

  return {
    patientFirstName: profile.patient_first_name ?? "le patient",
    patientAge: age,
    patientCountry: "France",
    patientRegion: region,
    cancerType: profile.cancer_type,
    cancerTypeLabel: profile.cancer_label,
    stage: profile.stage,
    diagnosisDate: profile.diagnosis_date,
    surgeryDate: profile.surgery_date,
    surgeryOutcome: profile.surgery_result,
    tumorCharacteristics,
    currentTreatments: treatments,
    expertNetwork: profile.reference_network,
    todayDate,
  };
}
