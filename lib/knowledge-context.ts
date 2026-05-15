/**
 * Utilitaires pour injecter la knowledge base dans les prompts des autres
 * modules (M1 analyzer, M3 consultation, M5 watch).
 */

import type { CancerKnowledge } from "./knowledge-prompts";

interface KbRow {
  cancer_type_label: string;
  version: number;
  generated_at: string;
  status: string;
  expert_network: unknown;
  staging_classification: unknown;
  biomarkers: unknown;
  standard_protocols: unknown;
  surveillance_recommendations: unknown;
  red_flags: unknown;
  genetic_considerations: unknown;
}

/**
 * Bloc de contexte compact à injecter dans le prompt système d'un autre module.
 * Sérialise les sections les plus utiles pour la personnalisation médicale.
 */
export function buildKnowledgeContextBlock(kb: KbRow | null): string {
  if (!kb || kb.status !== "ready") {
    return "";
  }

  return `

# Knowledge base ${kb.cancer_type_label} (v${kb.version}, générée le ${new Date(kb.generated_at).toLocaleDateString("fr-FR")})

Ce bloc est un référentiel partagé sur ce type de cancer. Utilise-le comme contexte
pour personnaliser ta réponse mais ne paraphrase pas son contenu inutilement.

## Réseau d'experts de référence
${jsonBlock(kb.expert_network)}

## Classification et stadification
${jsonBlock(kb.staging_classification)}

## Biomarqueurs clés
${jsonBlock(kb.biomarkers)}

## Protocoles standards
${jsonBlock(kb.standard_protocols)}

## Surveillance recommandée
${jsonBlock(kb.surveillance_recommendations)}

## Signes d'alerte (red flags)
${jsonBlock(kb.red_flags)}

## Considérations génétiques
${jsonBlock(kb.genetic_considerations)}
`;
}

function jsonBlock(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

/**
 * Sous-ensemble de la KB utile pour le module consultation (Module 3).
 * Filtre les key_questions_for_team selon le stade de parcours patient.
 */
export function filterQuestionsByStage(
  kb: { key_questions_for_team?: CancerKnowledge["key_questions_for_team"] } | null,
  stage: "diagnosis" | "treatment_decision" | "during_treatment" | "surveillance" | "recurrence",
): string[] {
  if (!kb?.key_questions_for_team) return [];
  return kb.key_questions_for_team
    .filter((q) => q.stage === stage)
    .flatMap((q) => q.questions);
}
