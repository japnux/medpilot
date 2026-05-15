import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface KbRow {
  id: string;
  cancer_type: string;
  cancer_type_label: string | null;
  status: string;
  version: number | null;
  generated_at: string | null;
  country: string | null;
  token_usage: { input_tokens?: number; output_tokens?: number } | null;
}

interface WatchRow {
  id: string;
  family_id: string;
  generated_at: string;
  model_used: string | null;
  executive_summary: string | null;
  token_usage: { input_tokens?: number; output_tokens?: number } | null;
}

/**
 * /admin/knowledge — Knowledge base partagée + veilles générées.
 * Permet de voir l'état de la KB par cancer (ready/generating/failed)
 * et le coût cumulé estimé.
 */
export default async function AdminKnowledgePage() {
  const svc = createServiceClient();

  const [kbRes, watchRes] = await Promise.all([
    svc
      .from("cancer_knowledge_base")
      .select(
        "id, cancer_type, cancer_type_label, status, version, generated_at, country, token_usage",
      )
      .order("generated_at", { ascending: false }),
    svc
      .from("watch_findings")
      .select(
        "id, family_id, generated_at, model_used, executive_summary, token_usage",
      )
      .order("generated_at", { ascending: false })
      .limit(30),
  ]);

  const kbs: KbRow[] = (kbRes.data ?? []) as KbRow[];
  const watches: WatchRow[] = (watchRes.data ?? []) as WatchRow[];

  // Coût approx KB (Opus 4.7 : $15 / $75 par million)
  const estCost = (
    usage: { input_tokens?: number; output_tokens?: number } | null,
  ): number => {
    if (!usage) return 0;
    return (
      ((usage.input_tokens ?? 0) / 1_000_000) * 15 +
      ((usage.output_tokens ?? 0) / 1_000_000) * 75
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink mb-1">Knowledge</h1>
        <p className="text-sm text-muted">
          Bases de référence par cancer + veilles générées
        </p>
      </div>

      {/* KB */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          Knowledge bases ({kbs.length})
        </h2>
        <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
          {kbs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Aucune KB</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-card text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Cancer</th>
                  <th className="text-left px-4 py-2 font-medium">Statut</th>
                  <th className="text-left px-4 py-2 font-medium">Version</th>
                  <th className="text-left px-4 py-2 font-medium">Pays</th>
                  <th className="text-left px-4 py-2 font-medium">Générée</th>
                  <th className="text-right px-4 py-2 font-medium">Tokens</th>
                  <th className="text-right px-4 py-2 font-medium">~Coût</th>
                </tr>
              </thead>
              <tbody>
                {kbs.map((kb) => (
                  <tr key={kb.id} className="border-t border-hairline">
                    <td className="px-4 py-2 text-ink">
                      {kb.cancer_type_label ?? kb.cancer_type}
                      <span className="text-muted text-xs ml-2 font-mono">
                        {kb.cancer_type}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={kb.status} />
                    </td>
                    <td className="px-4 py-2 text-body">{kb.version ?? "—"}</td>
                    <td className="px-4 py-2 text-body">{kb.country ?? "—"}</td>
                    <td className="px-4 py-2 text-muted text-xs">
                      {kb.generated_at
                        ? new Date(kb.generated_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-body tabular-nums">
                      {kb.token_usage
                        ? `${(kb.token_usage.input_tokens ?? 0) + (kb.token_usage.output_tokens ?? 0)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-ink tabular-nums">
                      ${estCost(kb.token_usage).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Watch findings */}
      <section>
        <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
          Dernières veilles ({watches.length})
        </h2>
        <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
          {watches.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Aucune veille</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-card text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">Famille</th>
                  <th className="text-left px-4 py-2 font-medium">Modèle</th>
                  <th className="text-left px-4 py-2 font-medium">Synthèse</th>
                  <th className="text-right px-4 py-2 font-medium">~Coût</th>
                </tr>
              </thead>
              <tbody>
                {watches.map((w) => (
                  <tr key={w.id} className="border-t border-hairline">
                    <td className="px-4 py-2 text-muted text-xs whitespace-nowrap">
                      {new Date(w.generated_at).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2 text-muted font-mono text-xs">
                      {w.family_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2 text-body text-xs">
                      {shortModel(w.model_used ?? "—")}
                    </td>
                    <td className="px-4 py-2 text-ink text-xs">
                      {truncate(w.executive_summary, 100)}
                    </td>
                    <td className="px-4 py-2 text-right text-ink tabular-nums">
                      ${estCost(w.token_usage).toFixed(3)}
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

function StatusBadge({ status }: { status: string }) {
  const COLORS: Record<string, string> = {
    ready: "bg-emerald-100 text-emerald-700",
    generating: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-medium ${COLORS[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status}
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
