import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface ActivityItem {
  ts: string;
  kind: string;
  label: string;
  family_id: string | null;
  badge?: string;
}

/**
 * /admin/logs — Flux d'activité unifié de la plateforme.
 * Agrège les écritures récentes sur les tables principales pour repérer
 * l'usage en un coup d'œil. Pour des logs serveur fins, voir Supabase Studio.
 */
export default async function AdminLogsPage() {
  const svc = createServiceClient();

  const [
    docs,
    bio,
    consult,
    timeline,
    symptoms,
    watch,
    surveillance,
    aiErr,
  ] = await Promise.all([
    svc
      .from("medical_documents")
      .select("id, created_at, document_type, family_id, title")
      .order("created_at", { ascending: false })
      .limit(30),
    svc
      .from("biology_records")
      .select("id, created_at, marker_name, family_id")
      .order("created_at", { ascending: false })
      .limit(30),
    svc
      .from("consultations")
      .select("id, created_at, consultation_type, family_id")
      .order("created_at", { ascending: false })
      .limit(30),
    svc
      .from("timeline_events")
      .select("id, created_at, event_type, title, family_id")
      .order("created_at", { ascending: false })
      .limit(30),
    svc
      .from("symptom_logs")
      .select("id, logged_at, fatigue, douleur, digestif, neuro, family_id")
      .order("logged_at", { ascending: false })
      .limit(30),
    svc
      .from("watch_findings")
      .select("id, generated_at, family_id")
      .order("generated_at", { ascending: false })
      .limit(20),
    svc
      .from("surveillance_alerts")
      .select("id, created_at, label, family_id, due_date")
      .order("created_at", { ascending: false })
      .limit(30),
    svc
      .from("api_usage_logs")
      .select("id, created_at, endpoint, model, error_message, family_id")
      .eq("success", false)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const items: ActivityItem[] = [];

  for (const d of docs.data ?? [])
    items.push({
      ts: d.created_at,
      kind: "document",
      label: `Document ${d.document_type ?? ""} — ${d.title ?? d.id.slice(0, 8)}`,
      family_id: d.family_id,
    });
  for (const b of bio.data ?? [])
    items.push({
      ts: b.created_at,
      kind: "biology",
      label: `Mesure : ${b.marker_name}`,
      family_id: b.family_id,
    });
  for (const c of consult.data ?? [])
    items.push({
      ts: c.created_at,
      kind: "consult",
      label: `Consultation ${c.consultation_type}`,
      family_id: c.family_id,
    });
  for (const e of timeline.data ?? [])
    items.push({
      ts: e.created_at,
      kind: "timeline",
      label: `${e.event_type}: ${e.title}`,
      family_id: e.family_id,
    });
  for (const s of symptoms.data ?? []) {
    const intensities = [
      s.fatigue != null ? `fat.${s.fatigue}` : null,
      s.douleur != null ? `dou.${s.douleur}` : null,
      s.digestif != null ? `dig.${s.digestif}` : null,
      s.neuro != null ? `neu.${s.neuro}` : null,
    ].filter(Boolean);
    items.push({
      ts: s.logged_at,
      kind: "symptom",
      label: `Symptômes : ${intensities.join(" · ") || "—"}`,
      family_id: s.family_id,
    });
  }
  for (const w of watch.data ?? [])
    items.push({
      ts: w.generated_at,
      kind: "watch",
      label: "Veille générée",
      family_id: w.family_id,
    });
  for (const a of surveillance.data ?? [])
    items.push({
      ts: a.created_at,
      kind: "surveillance",
      label: `Alerte : ${a.label} (${a.due_date})`,
      family_id: a.family_id,
    });
  for (const e of aiErr.data ?? [])
    items.push({
      ts: e.created_at,
      kind: "ai-error",
      label: `${e.endpoint} (${shortModel(e.model)}) : ${truncate(e.error_message, 80)}`,
      family_id: e.family_id,
      badge: "ERREUR",
    });

  items.sort((a, b) => b.ts.localeCompare(a.ts));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Flux d&apos;activité</h1>
        <p className="text-sm text-muted">
          Écritures récentes sur la plateforme · {items.length} événements
        </p>
      </div>

      <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-card text-muted text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-36">Date</th>
              <th className="text-left px-3 py-2 font-medium w-24">Type</th>
              <th className="text-left px-3 py-2 font-medium">Détail</th>
              <th className="text-left px-3 py-2 font-medium w-24">Famille</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-muted text-sm">
                  Aucun événement
                </td>
              </tr>
            ) : (
              items.slice(0, 200).map((it, i) => (
                <tr key={i} className="border-t border-hairline">
                  <td className="px-3 py-1.5 text-muted font-mono text-xs whitespace-nowrap">
                    {new Date(it.ts).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-1.5">
                    <KindBadge kind={it.kind} />
                  </td>
                  <td className="px-3 py-1.5 text-ink">
                    {it.badge && (
                      <span className="inline-block mr-2 px-1.5 py-0.5 text-[10px] font-medium uppercase rounded bg-red-100 text-red-700">
                        {it.badge}
                      </span>
                    )}
                    {it.label}
                  </td>
                  <td className="px-3 py-1.5 text-muted font-mono text-xs">
                    {it.family_id ? it.family_id.slice(0, 8) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const COLORS: Record<string, string> = {
    document: "bg-blue-100 text-blue-700",
    biology: "bg-emerald-100 text-emerald-700",
    consult: "bg-amber-100 text-amber-700",
    timeline: "bg-purple-100 text-purple-700",
    symptom: "bg-rose-100 text-rose-700",
    watch: "bg-cyan-100 text-cyan-700",
    surveillance: "bg-yellow-100 text-yellow-700",
    "ai-error": "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-medium ${COLORS[kind] ?? "bg-gray-100 text-gray-700"}`}
    >
      {kind}
    </span>
  );
}

function shortModel(m: string): string {
  if (m.includes("opus")) return "opus";
  if (m.includes("haiku")) return "haiku";
  if (m.includes("sonnet")) return "sonnet";
  return m;
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
