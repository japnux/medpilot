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
  const { data } = await supabase
    .from("medications")
    .select("*")
    .eq("family_id", familyId)
    .order("status", { ascending: true })
    .order("started_at", { ascending: false });

  return buildMedicationsContextBlock(data ?? []);
}
