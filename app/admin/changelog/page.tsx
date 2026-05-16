import { createServiceClient } from "@/lib/supabase/service";
import SyncButton from "./SyncButton";

export const dynamic = "force-dynamic";

interface EntryRow {
  id: string;
  commit_sha: string;
  commit_date: string;
  commit_message: string;
  commit_author: string | null;
  title: string;
  summary: string | null;
  category: "feature" | "improvement" | "fix" | "internal";
  user_visible: boolean;
  published_at: string;
}

const CATEGORY_LABELS: Record<EntryRow["category"], string> = {
  feature: "Nouveauté",
  improvement: "Amélioration",
  fix: "Correction",
  internal: "Technique",
};

const CATEGORY_COLORS: Record<EntryRow["category"], string> = {
  feature: "bg-emerald-100 text-emerald-700",
  improvement: "bg-blue-100 text-blue-700",
  fix: "bg-amber-100 text-amber-700",
  internal: "bg-gray-100 text-gray-700",
};

/**
 * /admin/changelog — Pilotage du changelog public.
 * - Liste toutes les entries (visibles ET techniques)
 * - Bouton pour synchroniser depuis GitHub
 */
export default async function AdminChangelogPage() {
  const svc = createServiceClient();

  const { data: rows } = await svc
    .from("changelog_entries")
    .select(
      "id, commit_sha, commit_date, commit_message, commit_author, title, summary, category, user_visible, published_at",
    )
    .order("published_at", { ascending: false })
    .limit(300);

  const entries: EntryRow[] = (rows ?? []) as EntryRow[];

  const stats = entries.reduce(
    (acc, e) => {
      acc.total += 1;
      if (e.user_visible) acc.visible += 1;
      acc.byCat[e.category] = (acc.byCat[e.category] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      visible: 0,
      byCat: {} as Record<string, number>,
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink mb-1">Changelog</h1>
          <p className="text-sm text-muted">
            {stats.total} entrée{stats.total > 1 ? "s" : ""} ·{" "}
            {stats.visible} visible{stats.visible > 1 ? "s" : ""} par les
            utilisateurs ({stats.total - stats.visible} technique
            {stats.total - stats.visible > 1 ? "s" : ""})
          </p>
        </div>
        <SyncButton limit={200} />
      </div>

      {/* Récap par catégorie */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Nouveautés" value={stats.byCat.feature ?? 0} color="emerald" />
        <Stat
          label="Améliorations"
          value={stats.byCat.improvement ?? 0}
          color="blue"
        />
        <Stat label="Corrections" value={stats.byCat.fix ?? 0} color="amber" />
        <Stat
          label="Techniques"
          value={stats.byCat.internal ?? 0}
          color="gray"
        />
      </div>

      {/* Liste */}
      <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
        {entries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">
            Aucune entrée. Cliquez sur « Synchroniser depuis GitHub » pour
            backfill l&apos;historique.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-card text-muted text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-28">Date</th>
                <th className="text-left px-3 py-2 font-medium w-24">
                  Catégorie
                </th>
                <th className="text-left px-3 py-2 font-medium">Titre / Résumé</th>
                <th className="text-left px-3 py-2 font-medium w-16">Visible</th>
                <th className="text-left px-3 py-2 font-medium w-20">SHA</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-hairline align-top">
                  <td className="px-3 py-2 text-muted text-xs whitespace-nowrap">
                    {new Date(e.published_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-medium ${CATEGORY_COLORS[e.category]}`}
                    >
                      {CATEGORY_LABELS[e.category]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-ink">{e.title}</div>
                    {e.summary && (
                      <div className="text-xs text-body mt-0.5">{e.summary}</div>
                    )}
                    <div
                      className="text-[10px] text-muted mt-1 font-mono truncate max-w-md"
                      title={e.commit_message}
                    >
                      {e.commit_message.split("\n")[0]}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {e.user_visible ? (
                      <span className="text-emerald-600 text-xs">✓</span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted font-mono text-xs">
                    <a
                      href={`https://github.com/japnux/medpilot/commit/${e.commit_sha}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-ink"
                    >
                      {e.commit_sha.slice(0, 7)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "blue" | "amber" | "gray";
}) {
  const COLORS = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    amber: "text-amber-700",
    gray: "text-gray-700",
  };
  return (
    <div className="bg-canvas-soft border border-hairline rounded-md px-4 py-3">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-xl font-semibold ${COLORS[color]} tabular-nums`}>
        {value}
      </div>
    </div>
  );
}
