/**
 * Templates de prompts système pour Claude.
 *
 * Interpolation simple {{var}} → value. Le contexte patient (cancer, stade,
 * traitements...) est injecté par les API routes côté serveur.
 */

import type { CancerProfile } from "./cancer-profiles";

export interface PromptContext {
  [key: string]: unknown;
  cancer_label: string;
  stage: string | null;
  diagnosis_date: string | null;
  surgery_date: string | null;
  surgery_result: string | null;
  active_treatments: string;
  key_biomarkers: string;
  reference_network: string | null;
  /** Points en suspens connus (consultation prep). */
  open_points?: string;
  /** Événements récents (consultation prep). */
  recent_events?: string;
  /** Contexte traitement libre (consultation prep). */
  treatment_context?: string;
}

/** Interpolation simple {{key}} → value. Les clés manquantes deviennent vides. */
export function interpolate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = ctx[key];
    if (v == null || v === "") return "non précisé";
    return String(v);
  });
}

/**
 * Construit le contexte string à partir d'un profil cancer Supabase row.
 * Sérialise les champs jsonb en chaînes lisibles pour le prompt.
 */
export function buildPromptContext(profile: {
  cancer_label: string;
  stage: string | null;
  diagnosis_date: string | null;
  surgery_date: string | null;
  surgery_result: string | null;
  active_treatments: unknown;
  key_biomarkers: unknown;
  reference_network: string | null;
}): PromptContext {
  return {
    cancer_label: profile.cancer_label,
    stage: profile.stage,
    diagnosis_date: profile.diagnosis_date,
    surgery_date: profile.surgery_date,
    surgery_result: profile.surgery_result,
    active_treatments: serializeJsonField(profile.active_treatments),
    key_biomarkers: serializeJsonField(profile.key_biomarkers),
    reference_network: profile.reference_network,
  };
}

function serializeJsonField(field: unknown): string {
  if (!field) return "aucun";
  if (Array.isArray(field)) {
    return field
      .map((item) => {
        if (typeof item === "object" && item != null) {
          return Object.entries(item)
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        }
        return String(item);
      })
      .join(" | ");
  }
  return JSON.stringify(field);
}

// -------------------------------------------------------------------
// Module 1 — Analyse de documents médicaux (Opus 4.7)
// -------------------------------------------------------------------
export const DOCUMENT_ANALYSIS_PROMPT = `Tu es un assistant médical expert en oncologie. Tu analyses des documents médicaux pour un accompagnant familial.

Profil patient (référence générale — peut ne pas refléter l'état à la date du document) :
- Cancer : {{cancer_label}}
- Stade : {{stage}}
- Date diagnostic : {{diagnosis_date}}
- Chirurgie : {{surgery_date}}, résultat {{surgery_result}}
- Biomarqueurs clés au diagnostic : {{key_biomarkers}}
- Réseau de référence : {{reference_network}}

⚠️ RÈGLE ABSOLUE SUR LES MÉDICAMENTS ⚠️

NE MENTIONNE AUCUN MÉDICAMENT (Mitotane, Lysodren, chimiothérapie, hormonothérapie, etc.) dans tes interprétations SAUF si le document analysé le nomme EXPLICITEMENT dans son texte.

- Ne déduis JAMAIS un médicament du contexte général.
- Si le document est daté AVANT la chirurgie ({{surgery_date}}), le patient n'a reçu AUCUN traitement adjuvant — n'invoque l'effet d'aucun médicament.
- Si tu hésites, n'évoque pas le médicament. Mieux vaut une interprétation incomplète qu'une fausse imputation.

Cette règle prime sur toutes les autres. Une seule mention erronée d'un médicament invalide l'analyse.

Tu produis UNIQUEMENT ce JSON (pas de texte avant ou après) :
{
  "document_type": "anapath|biologie|imagerie|courrier|ordonnance|compte_rendu_op|rcp|genetique|autre",
  "document_date": "YYYY-MM-DD ou null",
  "title": "titre court du document",
  "doctor_name": "nom du médecin principal signataire ou null si non visible (ex: Dr Thomas Volosov, Pr Eric Baudin). En cas de plusieurs signataires, prendre le plus mis en avant.",
  "summary_family": "3-4 phrases simples, sans jargon médical, pour un proche non médecin",
  "summary_clinical": "synthèse clinique complète pour l'accompagnant, interprétée par rapport au profil du patient",
  "key_values": [
    {
      "parameter": "nom du paramètre",
      "value": "valeur",
      "unit": "unité",
      "reference_range": "norme ou cible thérapeutique",
      "status": "normal|warning|critical|favorable|concerning",
      "interpretation": "interprétation courte en contexte"
    }
  ],
  "favorable_points": ["liste des éléments favorables"],
  "concerning_points": ["liste des éléments préoccupants"],
  "questions_for_team": [
    {
      "question": "question précise",
      "priority": "high|normal",
      "addressed_to": "oncologue|chirurgien|endocrinologue|radiologue|équipe générale"
    }
  ],
  "surveillance_triggered": [
    {
      "exam": "examen à planifier",
      "delay": "délai recommandé",
      "reason": "pourquoi"
    }
  ],
  "action_required": true,
  "action_details": "si action_required true : décrire l'action urgente"
}`;

// -------------------------------------------------------------------
// Module 3 — Préparation de consultation (Haiku 4.5)
// -------------------------------------------------------------------
export const CONSULTATION_PREP_PROMPT = `Tu prépares une consultation médicale pour l'accompagnant d'un patient atteint de {{cancer_label}}, stade {{stage}}.

# Profil patient
- Diagnostic : {{diagnosis_date}}
- Chirurgie : {{surgery_date}} ({{surgery_result}})
- Traitements actifs (aujourd'hui) : {{active_treatments}}
- Biomarqueurs clés au diagnostic : {{key_biomarkers}}
- Réseau de référence : {{reference_network}}

# Consultation à préparer
- Type de consultation : {{consultation_type}}
- Médecin : {{doctor_name}}
- Hôpital : {{hospital}}
- Date prévue : {{consultation_date}}
- Contexte traitement libre : {{treatment_context}}
- Points en suspens à aborder : {{open_points}}

# Derniers événements du parcours
{{recent_events}}

# Derniers documents analysés
{{recent_documents}}

# Bilan biologique récent (valeurs préoccupantes uniquement)
{{biology_alerts}}

# Équipe médicale connue du patient
{{care_team}}

# Mission

Génère une préparation de RDV utile pour l'accompagnant. Questions précises et directes, classées par thème et priorité. Cite uniquement des médicaments si explicitement présents dans le contexte. Compte tenu du type de consultation ({{consultation_type}}) et du médecin ({{doctor_name}}), priorise les questions qui relèvent de SA spécialité.

# Limites strictes de sortie (à respecter)
- "questions" : 10 max, les plus prioritaires d'abord.
- "documents_to_bring" : 6 max.
- "decisions_to_make" : 5 max.
- "open_points_from_before" : 5 max.
- "watch_for_during_consult" : 5 max.
- Chaque champ texte (question, context, élément de liste) : 220 caractères max.

Réponds UNIQUEMENT en JSON (sans markdown fence, sans préambule, sans texte après le } final) :
{
  "consultation_summary": "une phrase résumant l'enjeu de cette consultation",
  "questions": [
    {
      "theme": "Traitement|Surveillance|Effets indésirables|Décision|Génétique|Essai clinique|Autre",
      "question": "question précise et directe",
      "priority": "high|normal",
      "context": "pourquoi cette question est importante maintenant"
    }
  ],
  "documents_to_bring": ["liste des documents à apporter"],
  "decisions_to_make": ["décisions attendues lors de cette consultation"],
  "open_points_from_before": ["points non résolus des consultations précédentes"],
  "watch_for_during_consult": ["éléments à documenter pendant le RDV"]
}`;

/** Types de réponse attendue (à confronter au JSON parsé). */
export interface DocumentAnalysisResult {
  document_type: string;
  document_date: string | null;
  title: string;
  doctor_name: string | null;
  summary_family: string;
  summary_clinical: string;
  key_values: Array<{
    parameter: string;
    value: string;
    unit: string;
    reference_range: string;
    status: string;
    interpretation: string;
  }>;
  favorable_points: string[];
  concerning_points: string[];
  questions_for_team: Array<{
    question: string;
    priority: "high" | "normal";
    addressed_to: string;
  }>;
  surveillance_triggered: Array<{
    exam: string;
    delay: string;
    reason: string;
  }>;
  action_required: boolean;
  action_details: string | null;
}

export interface ConsultationPrepResult {
  consultation_summary: string;
  questions: Array<{
    theme: string;
    question: string;
    priority: "high" | "normal";
    context: string;
  }>;
  documents_to_bring: string[];
  decisions_to_make: string[];
  open_points_from_before: string[];
  watch_for_during_consult: string[];
}
