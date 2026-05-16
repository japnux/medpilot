import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface Entry {
  id: string;
  title: string;
  summary: string | null;
  category: "feature" | "improvement" | "fix" | "internal";
  published_at: string;
}

const CATEGORY_LABELS: Record<Entry["category"], string> = {
  feature: "Nouveauté",
  improvement: "Amélioration",
  fix: "Correction",
  internal: "Technique",
};

const CATEGORY_COLORS: Record<Entry["category"], string> = {
  feature: "bg-emerald-100 text-emerald-700",
  improvement: "bg-blue-100 text-blue-700",
  fix: "bg-amber-100 text-amber-700",
  internal: "bg-gray-100 text-gray-700",
};

/**
 * /changelog — Nouveautés de l'app, lisible par tous les users authentifiés.
 *
 * Lit `changelog_entries` (user_visible=true uniquement, RLS appliquée).
 * Groupé par mois pour la lisibilité.
 */
export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS filtre déjà user_visible=true
  const { data: entries } = await supabase
    .from("changelog_entries")
    .select("id, title, summary, category, published_at")
    .order("published_at", { ascending: false })
    .limit(200);

  const list: Entry[] = (entries ?? []) as Entry[];

  // Grouper par mois
  const byMonth = new Map<string, Entry[]>();
  for (const e of list) {
    const d = new Date(e.published_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink mb-1">
          Nouveautés
        </h1>
        <p className="text-sm text-muted">
          Les dernières évolutions de MedPilot
        </p>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">
          Pas encore de nouveautés publiées.
        </div>
      ) : (
        months.map(([month, items]) => (
          <section key={month}>
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">
              {formatMonth(month)}
            </h2>
            <div className="space-y-3">
              {items.map((e) => (
                <article
                  key={e.id}
                  className="bg-canvas-soft border border-hairline rounded-md p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="text-base font-medium text-ink leading-snug">
                      {e.title}
                    </h3>
                    <span
                      className={`shrink-0 inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-medium ${CATEGORY_COLORS[e.category]}`}
                    >
                      {CATEGORY_LABELS[e.category]}
                    </span>
                  </div>
                  {e.summary && (
                    <p className="text-sm text-body leading-relaxed">
                      {e.summary}
                    </p>
                  )}
                  <p className="text-xs text-muted mt-2">
                    {new Date(e.published_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function formatMonth(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
