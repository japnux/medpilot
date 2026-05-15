import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * /admin/ai — Détail des appels IA (api_usage_logs).
 * Agrégations par endpoint, modèle, jour. Liste des 100 derniers.
 */
export default async function AdminAiPage() {
  const svc = createServiceClient();

  // 30 derniers jours
  const since = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows } = await svc
    .from("api_usage_logs")
    .select(
      "id, created_at, endpoint, model, input_tokens, output_tokens, cost_usd, cached, success, error_message, duration_ms, family_id",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  const data = rows ?? [];

  // Agrégation par endpoint
  const byEndpoint = aggregate(data, (r) => r.endpoint);
  // Agrégation par modèle
  const byModel = aggregate(data, (r) => r.model);
  // Agrégation par jour
  const byDay = aggregate(data, (r) =>
    new Date(r.created_at).toISOString().slice(0, 10),
  );
  const sortedDays = [...byDay.entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  );
  const maxDayCost = Math.max(...sortedDays.map(([, v]) => v.cost), 0.0001);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Usage IA</h1>
        <p className="text-sm text-muted">
          30 derniers jours · {data.length} appels
        </p>
      </div>

      {/* Coût par jour (bar chart minimal) */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          Coût par jour
        </h2>
        <div className="bg-canvas-soft border border-hairline rounded-md p-4 space-y-1">
          {sortedDays.length === 0 ? (
            <p className="text-sm text-muted">Aucune donnée</p>
          ) : (
            sortedDays.slice(0, 14).map(([day, agg]) => (
              <div key={day} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-muted font-mono">
                  {day}
                </span>
                <div className="flex-1 h-5 bg-surface-card rounded relative overflow-hidden">
                  <div
                    className="h-full bg-blue-500/60"
                    style={{ width: `${(agg.cost / maxDayCost) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-ink tabular-nums">
                  ${agg.cost.toFixed(3)}
                </span>
                <span className="w-12 shrink-0 text-right text-muted tabular-nums">
                  {agg.calls}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Par endpoint */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          Par endpoint
        </h2>
        <AggTable rows={byEndpoint} keyLabel="Endpoint" />
      </section>

      {/* Par modèle */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          Par modèle
        </h2>
        <AggTable rows={byModel} keyLabel="Modèle" />
      </section>

      {/* Logs récents */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          100 derniers appels
        </h2>
        <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-card text-muted uppercase">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Endpoint</th>
                  <th className="text-left px-3 py-2 font-medium">Modèle</th>
                  <th className="text-right px-3 py-2 font-medium">In</th>
                  <th className="text-right px-3 py-2 font-medium">Out</th>
                  <th className="text-right px-3 py-2 font-medium">Coût</th>
                  <th className="text-right px-3 py-2 font-medium">Durée</th>
                  <th className="text-left px-3 py-2 font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map((r) => (
                  <tr key={r.id} className="border-t border-hairline">
                    <td className="px-3 py-1.5 text-muted font-mono whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-1.5 text-ink">{r.endpoint}</td>
                    <td className="px-3 py-1.5 text-body">
                      {shortModel(r.model)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-body tabular-nums">
                      {r.input_tokens.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-1.5 text-right text-body tabular-nums">
                      {r.output_tokens.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-1.5 text-right text-ink tabular-nums">
                      ${Number(r.cost_usd).toFixed(4)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted tabular-nums">
                      {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {!r.success ? (
                        <span
                          className="text-red-600"
                          title={r.error_message ?? undefined}
                        >
                          erreur
                        </span>
                      ) : r.cached ? (
                        <span className="text-emerald-600">cache</span>
                      ) : (
                        <span className="text-muted">ok</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

interface AggValue {
  calls: number;
  cost: number;
  input: number;
  output: number;
  cached: number;
  failed: number;
}

interface LogRow {
  cost_usd: number | string;
  input_tokens: number;
  output_tokens: number;
  cached: boolean;
  success: boolean;
}

function aggregate<T extends LogRow>(
  rows: T[],
  keyFn: (r: T) => string,
): Map<string, AggValue> {
  const m = new Map<string, AggValue>();
  for (const r of rows) {
    const k = keyFn(r);
    const v =
      m.get(k) ?? { calls: 0, cost: 0, input: 0, output: 0, cached: 0, failed: 0 };
    v.calls += 1;
    v.cost += Number(r.cost_usd) || 0;
    v.input += r.input_tokens ?? 0;
    v.output += r.output_tokens ?? 0;
    if (r.cached) v.cached += 1;
    if (!r.success) v.failed += 1;
    m.set(k, v);
  }
  return m;
}

function AggTable({
  rows,
  keyLabel,
}: {
  rows: Map<string, AggValue>;
  keyLabel: string;
}) {
  const sorted = [...rows.entries()].sort((a, b) => b[1].cost - a[1].cost);
  if (sorted.length === 0) {
    return (
      <div className="bg-canvas-soft border border-hairline rounded-md p-4 text-sm text-muted">
        Aucune donnée
      </div>
    );
  }
  return (
    <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-card text-muted text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2 font-medium">{keyLabel}</th>
            <th className="text-right px-4 py-2 font-medium">Appels</th>
            <th className="text-right px-4 py-2 font-medium">Cache</th>
            <th className="text-right px-4 py-2 font-medium">Échecs</th>
            <th className="text-right px-4 py-2 font-medium">In</th>
            <th className="text-right px-4 py-2 font-medium">Out</th>
            <th className="text-right px-4 py-2 font-medium">Coût</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([k, v]) => (
            <tr key={k} className="border-t border-hairline">
              <td className="px-4 py-2 text-ink">{k}</td>
              <td className="px-4 py-2 text-right text-body tabular-nums">
                {v.calls}
              </td>
              <td className="px-4 py-2 text-right text-emerald-700 tabular-nums">
                {v.cached || "—"}
              </td>
              <td className="px-4 py-2 text-right text-red-600 tabular-nums">
                {v.failed || "—"}
              </td>
              <td className="px-4 py-2 text-right text-body tabular-nums">
                {v.input.toLocaleString("fr-FR")}
              </td>
              <td className="px-4 py-2 text-right text-body tabular-nums">
                {v.output.toLocaleString("fr-FR")}
              </td>
              <td className="px-4 py-2 text-right text-ink tabular-nums">
                ${v.cost.toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shortModel(m: string): string {
  if (m.includes("opus")) return "opus";
  if (m.includes("haiku")) return "haiku";
  if (m.includes("sonnet")) return "sonnet";
  return m;
}
