/**
 * Détection d'obsolescence d'une décision : combine plusieurs signaux pour
 * décider si la décision est probablement caduque. Pas d'archivage auto :
 * on remonte les signaux à l'UI qui propose une validation 1-clic.
 *
 * Signaux :
 *  1. deadline_30d_past — échéance dépassée de plus de 30 jours.
 *  2. surgery_passed_with_pre_op_mention — la décision mentionne "pré-op"
 *     mais la chirurgie a déjà eu lieu.
 *  3. consultation_after_creation — au moins 2 consultations completed
 *     après la création de la décision, sans qu'elle ait été tranchée.
 *  4. event_referenced_passed — date explicite (JJ/MM/AAAA) trouvée dans le
 *     titre/question, qui est passée.
 */

import type { DecisionRow, ObsolescenceSignal } from "./decisions";

interface MinimalConsultation {
  status: string;
  consultation_date: string;
}

interface MinimalProfile {
  surgery_date: string | null;
}

export function detectObsolescenceSignals(
  decision: DecisionRow,
  consultations: MinimalConsultation[],
  profile: MinimalProfile | null,
): ObsolescenceSignal[] {
  const signals: ObsolescenceSignal[] = [];
  const now = Date.now();
  const text = `${decision.title} ${decision.question ?? ""}`.toLowerCase();

  // 1. Échéance dépassée > 30 jours
  if (decision.due_date) {
    const daysPast = Math.floor(
      (now - new Date(decision.due_date).getTime()) / 86_400_000,
    );
    if (daysPast > 30) {
      signals.push({
        type: "deadline_30d_past",
        label: `Échéance dépassée de ${daysPast} jours`,
        confidence: "high",
      });
    }
  }

  // 2. Chirurgie effectuée alors que décision pré-op
  if (profile?.surgery_date) {
    const surgeryDate = new Date(profile.surgery_date);
    const isPreOp =
      text.includes("pré-op") ||
      text.includes("preop") ||
      text.includes("avant chirurgie") ||
      text.includes("avant la chirurgie") ||
      text.includes("avant l'opération") ||
      text.includes("préopératoire");
    if (isPreOp && surgeryDate.getTime() < now) {
      signals.push({
        type: "surgery_passed_with_pre_op_mention",
        label: `Chirurgie effectuée le ${surgeryDate.toLocaleDateString("fr-FR")}, décision pré-opératoire`,
        confidence: "high",
      });
    }
  }

  // 3. Consultations completed après création
  const decisionCreatedAt = new Date(decision.created_at).getTime();
  const consultsAfter = consultations.filter(
    (c) =>
      c.status === "completed" &&
      new Date(c.consultation_date).getTime() > decisionCreatedAt,
  );
  if (consultsAfter.length >= 2 && decision.status === "pending") {
    signals.push({
      type: "consultation_after_creation",
      label: `${consultsAfter.length} consultation(s) tenue(s) depuis la création`,
      confidence: "medium",
    });
  }

  // 4. Date explicite passée dans le texte
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  const textWithQ = `${decision.title} ${decision.question ?? ""}`;
  let match: RegExpExecArray | null;
  while ((match = datePattern.exec(textWithQ)) !== null) {
    const referencedDate = new Date(
      parseInt(match[3], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[1], 10),
    );
    if (referencedDate.getTime() < now) {
      signals.push({
        type: "event_referenced_passed",
        label: `Événement référencé (${match[0]}) est passé`,
        confidence: "medium",
      });
      break;
    }
  }

  return signals;
}

/**
 * Au moins 1 signal high confidence OU 2 signaux medium.
 */
export function shouldFlagObsolete(signals: ObsolescenceSignal[]): boolean {
  const high = signals.filter((s) => s.confidence === "high").length;
  const med = signals.filter((s) => s.confidence === "medium").length;
  return high >= 1 || med >= 2;
}
