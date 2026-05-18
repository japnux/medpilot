/**
 * Injection du dernier `watch_findings` dans la prep consultation.
 *
 * Format compact : executive_summary + top_priorities + alertes critiques.
 * On NE met PAS le détail des essais cliniques / publications / centres :
 * trop volumineux pour un prompt Haiku et redondant si l'utilisateur a
 * besoin du détail il va sur /watch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface TopPriority {
  action?: string;
  rationale?: string;
  deadline_suggestion?: string;
}

interface ContextualAlert {
  severity?: string;
  title?: string;
  message?: string;
}

export async function buildWatchPrepContext(
  supabase: SupabaseClient,
  familyId: string,
): Promise<string> {
  const { data } = await supabase
    .from("watch_findings")
    .select(
      "executive_summary, top_priorities, contextual_alerts, generated_at",
    )
    .eq("family_id", familyId)
    .eq("is_archived", false)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return "aucune veille générée pour l'instant";

  const lines: string[] = [];
  const generatedAt = new Date(data.generated_at).toLocaleDateString("fr-FR");
  lines.push(`Veille générée le ${generatedAt}.`);

  if (data.executive_summary) {
    lines.push("");
    lines.push("## Résumé exécutif");
    lines.push(String(data.executive_summary).trim());
  }

  const priorities = Array.isArray(data.top_priorities)
    ? (data.top_priorities as TopPriority[])
    : [];
  if (priorities.length > 0) {
    lines.push("");
    lines.push("## Top priorités (à inscrire à l'ordre du jour si pertinent)");
    for (const p of priorities.slice(0, 5)) {
      const tail: string[] = [];
      if (p.deadline_suggestion) tail.push(`échéance : ${p.deadline_suggestion}`);
      lines.push(
        `- ${p.action ?? "?"}${tail.length ? ` (${tail.join(" · ")})` : ""}${p.rationale ? `\n  Pourquoi : ${p.rationale}` : ""}`,
      );
    }
  }

  const alerts = Array.isArray(data.contextual_alerts)
    ? (data.contextual_alerts as ContextualAlert[])
    : [];
  const critical = alerts.filter((a) => a.severity === "critical");
  if (critical.length > 0) {
    lines.push("");
    lines.push("## Alertes contextuelles critiques");
    for (const a of critical.slice(0, 3)) {
      const t = a.title ? `**${a.title}** — ` : "";
      lines.push(`- ${t}${a.message ?? ""}`);
    }
  }

  return lines.join("\n");
}
