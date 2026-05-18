/**
 * Injection du contexte médicaments dans les prompts IA des autres modules
 * (M1 analyzer, M3 consultation, M5 watch).
 *
 * Le bloc retourné est concaténé au prompt système. Format markdown compact
 * pour minimiser les tokens (max ~500 tokens en pratique).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Medication } from "@/lib/medications-helpers";
import { getRouteLabel } from "@/lib/medications-helpers";

const STOPPED_MAX = 5;

/**
 * Construit le bloc de contexte à injecter dans le system prompt.
 * - Section principale : médicaments `active`.
 * - Section historique : 5 derniers `stopped` (avec raison/date si présentes).
 * - Statuts `paused` et `planned` sont listés en bas dans une section dédiée.
 */
export function buildMedicationsContextBlock(
  medications: Medication[],
): string {
  if (medications.length === 0) {
    return "\n\n# Médicaments du patient\n\nAucun médicament renseigné.";
  }

  const active = medications.filter((m) => m.status === "active");
  const paused = medications.filter((m) => m.status === "paused");
  const planned = medications.filter((m) => m.status === "planned");
  const stopped = medications
    .filter((m) => m.status === "stopped")
    .slice(0, STOPPED_MAX);

  const formatLine = (m: Medication): string => {
    const parts: (string | null)[] = [
      `**${m.name}**${m.brand_name ? ` (${m.brand_name})` : ""}`,
      m.dosage ?? null,
      m.posology,
      m.route !== "oral" ? `voie ${getRouteLabel(m.route)}` : null,
      m.indication ? `Indication : ${m.indication}` : null,
      m.started_at
        ? `depuis le ${new Date(m.started_at).toLocaleDateString("fr-FR")}`
        : null,
    ];
    return `- ${parts.filter(Boolean).join(" · ")}`;
  };

  let block = `\n\n# Médicaments du patient`;

  if (active.length > 0) {
    block += `\n\n## En cours (${active.length})\n\n${active.map(formatLine).join("\n")}`;
  } else {
    block += `\n\nAucun médicament actif renseigné.`;
  }

  if (planned.length > 0) {
    block += `\n\n## Planifiés (pas encore démarrés)\n\n${planned.map(formatLine).join("\n")}`;
  }

  if (paused.length > 0) {
    block += `\n\n## Suspendus temporairement\n\n${paused
      .map((m) => {
        const reason = m.status_reason ? ` — raison : ${m.status_reason}` : "";
        return `- ${m.name}${m.dosage ? ` ${m.dosage}` : ""}${reason}`;
      })
      .join("\n")}`;
  }

  if (stopped.length > 0) {
    block += `\n\n## Récemment arrêtés (contexte historique)\n\n${stopped
      .map((m) => {
        const reason = m.status_reason ? ` — raison : ${m.status_reason}` : "";
        const endDate = m.ended_at
          ? ` le ${new Date(m.ended_at).toLocaleDateString("fr-FR")}`
          : "";
        return `- ${m.name}${m.dosage ? ` ${m.dosage}` : ""} : arrêté${endDate}${reason}`;
      })
      .join("\n")}`;
  }

  return block;
}

/**
 * Helper appelable depuis n'importe quelle API route Claude.
 * Charge la liste des médicaments d'une famille et retourne directement
 * le bloc markdown à concaténer au prompt système.
 *
 * Pas de cache : la liste est petite (< 50 lignes typiquement) et change
 * potentiellement entre 2 appels (édition réaliste).
 */
export async function enrichWithMedications(
  supabase: SupabaseClient<Database>,
  familyId: string,
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: meds }, { data: changes }, { data: scheduleSteps }] =
    await Promise.all([
      supabase
        .from("medications")
        .select("*")
        .eq("family_id", familyId)
        .order("status", { ascending: true })
        .order("started_at", { ascending: false }),
      // Derniers 6 changements de dose, contexte clinique utile
      supabase
        .from("medication_dosage_changes")
        .select(
          "medication_id, changed_at, previous_dosage, new_dosage, reason, prescriber",
        )
        .eq("family_id", familyId)
        .order("changed_at", { ascending: false })
        .limit(6),
      // Paliers de schedule actifs (médocs avec un plan posologique multi-étapes)
      supabase
        .from("medication_schedule_steps")
        .select(
          "medication_id, step_order, start_date, end_date, dosage, posology, medications!inner(family_id, status)",
        )
        .eq("medications.family_id", familyId)
        .eq("medications.status", "active"),
    ]);

  let block = buildMedicationsContextBlock(meds ?? []);

  // Palier en cours pour chaque médoc actif : on identifie le step dont
  // [start_date, end_date] contient today (ou end_date=null = palier ouvert).
  if (scheduleSteps && scheduleSteps.length > 0 && meds && meds.length > 0) {
    const nameById = new Map(meds.map((m) => [m.id, m.name]));
    type StepRow = {
      medication_id: string;
      step_order: number;
      start_date: string;
      end_date: string | null;
      dosage: string | null;
      posology: string | null;
    };
    const byMed = new Map<string, StepRow[]>();
    for (const s of scheduleSteps as unknown as StepRow[]) {
      const arr = byMed.get(s.medication_id) ?? [];
      arr.push(s);
      byMed.set(s.medication_id, arr);
    }
    const currentLines: string[] = [];
    for (const [medId, steps] of byMed.entries()) {
      steps.sort((a, b) => a.step_order - b.step_order);
      const current = steps.find(
        (s) =>
          s.start_date <= today && (s.end_date === null || s.end_date >= today),
      );
      if (!current) continue;
      const name = nameById.get(medId) ?? "Médicament";
      const total = steps.length;
      const endLabel = current.end_date
        ? `jusqu'au ${new Date(current.end_date).toLocaleDateString("fr-FR")}`
        : "palier de maintien (sans date de fin)";
      currentLines.push(
        `- **${name}** : palier ${current.step_order}/${total} en cours · ${current.dosage ?? "?"}${current.posology ? ` (${current.posology})` : ""} · ${endLabel}`,
      );
    }
    if (currentLines.length > 0) {
      block += `\n\n## Palier posologique en cours\n\n${currentLines.join("\n")}`;
    }
  }

  if (changes && changes.length > 0 && meds && meds.length > 0) {
    const nameById = new Map(meds.map((m) => [m.id, m.name]));
    block += `\n\n## Derniers ajustements de dose\n\n`;
    block += changes
      .map((c) => {
        const name = nameById.get(c.medication_id) ?? "Médicament";
        const date = new Date(c.changed_at).toLocaleDateString("fr-FR");
        const delta = `${c.previous_dosage ?? "?"} → ${c.new_dosage}`;
        const tail = [c.reason, c.prescriber ? `Dr ${c.prescriber}` : null]
          .filter(Boolean)
          .join(" · ");
        return `- ${date} · **${name}** : ${delta}${tail ? ` (${tail})` : ""}`;
      })
      .join("\n");
  }
  return block;
}
