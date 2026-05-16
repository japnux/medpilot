/**
 * Injection du contexte symptômes dans la prep consultation.
 * Format compact pour limiter les tokens : top 5 symptômes par fréquence,
 * sévérité moyenne, dernier épisode + critical en premier.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SymptomLog } from "./symptoms";

export async function buildSymptomContext(
  supabase: SupabaseClient,
  familyId: string,
  daysBack: number = 14,
): Promise<string> {
  const since = new Date(
    Date.now() - daysBack * 86_400_000,
  ).toISOString();

  const { data } = await supabase
    .from("symptom_logs")
    .select(
      "symptom_type, symptom_label, severity, wellbeing_score, logged_at, is_critical, red_flag_matched, category",
    )
    .eq("family_id", familyId)
    .gte("logged_at", since)
    .order("logged_at", { ascending: false });

  if (!data || data.length === 0) {
    return `aucun symptôme rapporté ces ${daysBack} derniers jours`;
  }

  const entries = data as Pick<
    SymptomLog,
    | "symptom_type"
    | "symptom_label"
    | "severity"
    | "wellbeing_score"
    | "logged_at"
    | "is_critical"
    | "red_flag_matched"
    | "category"
  >[];

  // Group par symptom_label
  const groups = new Map<
    string,
    {
      count: number;
      severities: number[];
      last: string;
      categories: Set<string>;
    }
  >();
  for (const e of entries) {
    if (!e.symptom_label) continue;
    const g = groups.get(e.symptom_label) ?? {
      count: 0,
      severities: [],
      last: e.logged_at,
      categories: new Set<string>(),
    };
    g.count++;
    if (typeof e.severity === "number") g.severities.push(e.severity);
    if (e.category) g.categories.add(e.category);
    if (new Date(e.logged_at) > new Date(g.last)) g.last = e.logged_at;
    groups.set(e.symptom_label, g);
  }

  // Top 5 par fréquence
  const top = Array.from(groups.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const lines: string[] = [];
  for (const [label, g] of top) {
    const avg = g.severities.length
      ? Math.round(
          g.severities.reduce((a, b) => a + b, 0) / g.severities.length,
        )
      : null;
    lines.push(
      `- ${label} : ${g.count}×${avg !== null ? `, sévérité ~${avg}/10` : ""}, dernier le ${new Date(g.last).toLocaleDateString("fr-FR")}`,
    );
  }

  // Critiques
  const criticals = entries.filter((e) => e.is_critical);
  if (criticals.length > 0) {
    lines.push(`⚠️ ${criticals.length} symptôme(s) flaggé(s) critique(s) :`);
    for (const c of criticals.slice(0, 3)) {
      lines.push(
        `  - ${c.symptom_label} (${new Date(c.logged_at).toLocaleDateString("fr-FR")}) — red flag : ${c.red_flag_matched ?? "?"}`,
      );
    }
  }

  // Wellbeing
  const wellbeings = entries
    .map((e) => e.wellbeing_score)
    .filter((s): s is number => typeof s === "number");
  if (wellbeings.length > 0) {
    const avg = (
      wellbeings.reduce((a, b) => a + b, 0) / wellbeings.length
    ).toFixed(1);
    lines.push(`Bien-être moyen : ${avg}/5 sur ${wellbeings.length} check-ins`);
  }

  return lines.join("\n");
}
