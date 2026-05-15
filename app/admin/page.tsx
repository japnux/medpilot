import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * /admin — Vue d'ensemble de la plateforme MedPilot.
 * Tout passe par la clé service_role (bypass RLS).
 */
export default async function AdminOverviewPage() {
  const svc = createServiceClient();

  // Stats globales (count par table)
  const counts = await Promise.all([
    svc.from("families").select("id", { count: "exact", head: true }),
    svc.from("family_members").select("id", { count: "exact", head: true }),
    svc.from("cancer_profiles").select("id", { count: "exact", head: true }),
    svc.from("biology_records").select("id", { count: "exact", head: true }),
    svc.from("medical_documents").select("id", { count: "exact", head: true }),
    svc.from("consultations").select("id", { count: "exact", head: true }),
    svc.from("timeline_events").select("id", { count: "exact", head: true }),
    svc.from("symptom_logs").select("id", { count: "exact", head: true }),
    svc.from("surveillance_alerts").select("id", { count: "exact", head: true }),
    svc.from("cancer_knowledge_base").select("id", { count: "exact", head: true }),
    svc.from("watch_findings").select("id", { count: "exact", head: true }),
    svc.from("ai_cache").select("id", { count: "exact", head: true }),
  ]);

  const [
    families,
    members,
    profiles,
    biology,
    documents,
    consultations,
    timeline,
    symptoms,
    surveillance,
    kb,
    watch,
    aiCache,
  ] = counts.map((c) => c.count ?? 0);

  // Stats IA depuis api_usage_logs
  const { data: aiAgg } = await svc
    .from("api_usage_logs")
    .select("cost_usd, input_tokens, output_tokens, cached, success")
    .gte(
      "created_at",
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );

  const totals = (aiAgg ?? []).reduce(
    (acc, r) => {
      acc.calls += 1;
      acc.cost += Number(r.cost_usd) || 0;
      acc.input += r.input_tokens ?? 0;
      acc.output += r.output_tokens ?? 0;
      if (r.cached) acc.cached += 1;
      if (!r.success) acc.failed += 1;
      return acc;
    },
    { calls: 0, cost: 0, input: 0, output: 0, cached: 0, failed: 0 },
  );

  const last24h = (aiAgg ?? []).filter(
    () => false, // placeholder
  );
  // Recalcul 24h avec date filter
  const { data: ai24h } = await svc
    .from("api_usage_logs")
    .select("cost_usd")
    .gte(
      "created_at",
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );
  const cost24h = (ai24h ?? []).reduce(
    (s, r) => s + (Number(r.cost_usd) || 0),
    0,
  );
  void last24h;

  // Activité récente (familles)
  const { data: recentFamilies } = await svc
    .from("families")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Vue d&apos;ensemble</h1>
        <p className="text-sm text-muted">État global de la plateforme</p>
      </div>

      {/* KPIs IA (30 jours) */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          IA · 30 derniers jours
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Coût total" value={`$${totals.cost.toFixed(2)}`} sub={`24h : $${cost24h.toFixed(2)}`} />
          <Kpi label="Appels IA" value={totals.calls.toLocaleString("fr-FR")} sub={`${totals.cached} cache hit · ${totals.failed} échec`} />
          <Kpi
            label="Tokens input"
            value={formatTokens(totals.input)}
          />
          <Kpi
            label="Tokens output"
            value={formatTokens(totals.output)}
          />
        </div>
      </section>

      {/* KPIs données */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          Données
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Familles" value={families} />
          <Kpi label="Membres" value={members} />
          <Kpi label="Profils cancer" value={profiles} />
          <Kpi label="Documents" value={documents} />
          <Kpi label="Mesures biologiques" value={biology} />
          <Kpi label="Consultations" value={consultations} />
          <Kpi label="Événements timeline" value={timeline} />
          <Kpi label="Symptômes" value={symptoms} />
          <Kpi label="Alertes surveillance" value={surveillance} />
          <Kpi label="Knowledge bases" value={kb} />
          <Kpi label="Veilles" value={watch} />
          <Kpi label="Cache IA" value={aiCache} />
        </div>
      </section>

      {/* Familles récentes */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          Familles récentes
        </h2>
        <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
          {(recentFamilies ?? []).length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">
              Aucune famille
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-card text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nom</th>
                  <th className="text-left px-4 py-2 font-medium">Créée le</th>
                  <th className="text-left px-4 py-2 font-medium font-mono">ID</th>
                </tr>
              </thead>
              <tbody>
                {recentFamilies!.map((f) => (
                  <tr key={f.id} className="border-t border-hairline">
                    <td className="px-4 py-2 text-ink">{f.name ?? "—"}</td>
                    <td className="px-4 py-2 text-body">
                      {new Date(f.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-2 text-muted font-mono text-xs">
                      {f.id.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-canvas-soft border border-hairline rounded-md px-4 py-3">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-xl font-semibold text-ink tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n > 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}
