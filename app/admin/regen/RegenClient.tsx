"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Play,
} from "lucide-react";

interface KbItem {
  id: string;
  cancer_type: string;
  cancer_type_label: string | null;
  status: string;
  generated_at: string | null;
}

interface DocItem {
  id: string;
  title: string;
  document_type: string;
  document_date: string | null;
  family_id: string;
  created_at: string;
  analysis_updated_at: string | null;
}

interface WatchItem {
  id: string;
  family_id: string;
  generated_at: string;
}

type ItemStatus = "pending" | "running" | "done" | "error";

interface Tracked {
  kind: "knowledge" | "document" | "watch";
  key: string; // unique pour ce render (cancer_type | doc.id | family_id)
  label: string;
  sub?: string;
  /** Date ISO de la dernière régénération côté DB (null = jamais regen). */
  lastRegenAt: string | null;
  estCostEur: number;
  status: ItemStatus;
  error?: string;
  durationMs?: number;
}

interface Props {
  knowledgeBases: KbItem[];
  documents: DocItem[];
  watchFindings: WatchItem[];
}

// Coût estimé en € (au taux 1.05€/$1)
const COST = {
  knowledge: 0.15, // Opus + web_search
  document: 0.05, // Opus PDF
  watch: 0.75, // Opus + web_search large
};

export default function RegenClient({
  knowledgeBases,
  documents,
  watchFindings,
}: Props) {
  const router = useRouter();

  // 1 entrée par ressource à regen. On dédoublonne les veilles par family_id
  // (on ne regen qu'une fois par famille, pas par finding historique).
  const initialItems: Tracked[] = [
    ...knowledgeBases.map<Tracked>((k) => ({
      kind: "knowledge",
      key: k.cancer_type,
      label: k.cancer_type_label ?? k.cancer_type,
      sub: `Knowledge base · ${k.cancer_type}`,
      lastRegenAt: k.generated_at,
      estCostEur: COST.knowledge,
      status: "pending",
    })),
    ...documents.map<Tracked>((d) => ({
      kind: "document",
      key: d.id,
      label: d.title,
      sub: `${d.document_type}${d.document_date ? ` · ${d.document_date}` : ""}`,
      lastRegenAt: d.analysis_updated_at ?? d.created_at,
      estCostEur: COST.document,
      status: "pending",
    })),
    ...uniqByFamily(watchFindings).map<Tracked>((w) => ({
      kind: "watch",
      key: w.family_id,
      label: "Veille proactive",
      sub: `Famille ${w.family_id.slice(0, 8)}…`,
      lastRegenAt: w.generated_at,
      estCostEur: COST.watch,
      status: "pending",
    })),
  ];

  const [items, setItems] = useState<Tracked[]>(initialItems);
  const [running, setRunning] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);

  const totalCost = items.reduce((s, i) => s + i.estCostEur, 0);
  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  async function runAll() {
    if (
      !confirm(
        `Régénérer ${items.length} ressources via Claude ?\n\nCoût estimé : ~${totalCost.toFixed(2)} €\n\nDurée approximative : ${Math.ceil(items.length * 1)} minutes.\n\nL'opération est séquentielle (pas de parallélisme côté Anthropic). Tu peux fermer cette page, mais les regen lancées termineront seules côté serveur.`,
      )
    ) {
      return;
    }
    setRunning(true);
    for (let i = 0; i < items.length; i++) {
      setCursor(i);
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "running" } : it)),
      );
      const item = items[i];
      try {
        const t0 = Date.now();
        const body =
          item.kind === "knowledge"
            ? { kind: "knowledge", cancer_type: item.key }
            : item.kind === "document"
              ? { kind: "document", id: item.key }
              : { kind: "watch", family_id: item.key };
        const res = await fetch("/api/admin/regen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Erreur inconnue");
        }
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "done",
                  durationMs: Date.now() - t0,
                  lastRegenAt: new Date().toISOString(),
                }
              : it,
          ),
        );
      } catch (e) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "error",
                  error: e instanceof Error ? e.message : String(e),
                }
              : it,
          ),
        );
      }
    }
    setCursor(null);
    setRunning(false);
    router.refresh();
  }

  /**
   * Lance la regen d'une seule entité. Utilisé par le bouton "Relancer"
   * sur erreur ET par le bouton "Régénérer" en ligne sur chaque ressource.
   */
  async function runOne(i: number) {
    const item = items[i];
    if (item.status === "running") return;
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === i ? { ...it, status: "running", error: undefined } : it,
      ),
    );
    try {
      const t0 = Date.now();
      const body =
        item.kind === "knowledge"
          ? { kind: "knowledge", cancer_type: item.key }
          : item.kind === "document"
            ? { kind: "document", id: item.key }
            : { kind: "watch", family_id: item.key };
      const res = await fetch("/api/admin/regen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur");
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? {
                ...it,
                status: "done",
                durationMs: Date.now() - t0,
                lastRegenAt: new Date().toISOString(),
              }
            : it,
        ),
      );
    } catch (e) {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? {
                ...it,
                status: "error",
                error: e instanceof Error ? e.message : String(e),
              }
            : it,
        ),
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Tout régénérer</h1>
          <p className="text-sm text-muted mt-1">
            Re-passe à Claude tout le contenu existant (KB, documents, veilles)
            avec les prompts à jour — utile après une évolution majeure
            (ex: ajout du mode Apaisé).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="À regénérer" value={items.length.toString()} />
        <Stat label="Coût estimé" value={`~${totalCost.toFixed(2)} €`} />
        <Stat label="Terminés" value={`${doneCount}/${items.length}`} color="emerald" />
        <Stat
          label="Erreurs"
          value={errorCount.toString()}
          color={errorCount > 0 ? "red" : "gray"}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runAll}
          disabled={running || items.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-ink text-canvas text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          {running
            ? `Régénération en cours… (${doneCount + errorCount}/${items.length})`
            : "Lancer la régénération complète"}
        </button>
      </div>

      <div className="bg-canvas-soft border border-hairline rounded-md overflow-hidden">
        {items.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">
            Rien à régénérer pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {items.map((it, idx) => (
              <li key={`${it.kind}:${it.key}`} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <StatusIcon
                    status={it.status}
                    isCursor={cursor === idx}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink">
                        {it.label}
                      </span>
                      <KindBadge kind={it.kind} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted mt-0.5">
                      {it.sub && <span>{it.sub}</span>}
                      {it.lastRegenAt && (
                        <span
                          title={new Date(it.lastRegenAt).toLocaleString("fr-FR")}
                        >
                          🔄 Dernière regen : {formatRelative(it.lastRegenAt)}
                        </span>
                      )}
                    </div>
                    {it.error && (
                      <p className="text-xs text-red-600 mt-1">
                        ⚠️ {it.error}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs shrink-0 flex flex-col items-end gap-1">
                    {it.durationMs ? (
                      <span className="text-muted tabular-nums">
                        {(it.durationMs / 1000).toFixed(0)}s
                      </span>
                    ) : (
                      <span className="text-muted">
                        ~{it.estCostEur.toFixed(2)} €
                      </span>
                    )}
                    {/* Bouton unitaire : visible pour pending/done/error
                        (pas pendant running, pas pendant la boucle globale). */}
                    {it.status !== "running" && (
                      <button
                        type="button"
                        onClick={() => runOne(idx)}
                        disabled={running}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border transition-colors disabled:opacity-40 ${
                          it.status === "error"
                            ? "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                            : it.status === "done"
                              ? "border-hairline text-muted hover:text-ink hover:bg-canvas"
                              : "border-hairline text-body hover:text-ink hover:bg-canvas"
                        }`}
                        title={
                          it.status === "error"
                            ? "Relancer cette entité"
                            : it.status === "done"
                              ? "Régénérer à nouveau cette entité"
                              : "Régénérer uniquement cette entité"
                        }
                      >
                        <Play className="w-3 h-3" />
                        {it.status === "error"
                          ? "Relancer"
                          : it.status === "done"
                            ? "Refaire"
                            : "Régénérer"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function uniqByFamily(rows: WatchItem[]): WatchItem[] {
  const seen = new Set<string>();
  const out: WatchItem[] = [];
  for (const r of rows) {
    if (seen.has(r.family_id)) continue;
    seen.add(r.family_id);
    out.push(r);
  }
  return out;
}

/**
 * Date relative concise en français : "il y a 5 min", "il y a 3h",
 * "il y a 2 j", "il y a 1 mois", etc. Pas de librairie pour rester léger.
 */
function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const s = Math.round(diff / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `il y a ${d} j`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const y = Math.round(mo / 12);
  return `il y a ${y} an${y > 1 ? "s" : ""}`;
}

function Stat({
  label,
  value,
  color = "ink",
}: {
  label: string;
  value: string;
  color?: "ink" | "emerald" | "red" | "gray";
}) {
  const COLORS = {
    ink: "text-ink",
    emerald: "text-emerald-700",
    red: "text-red-700",
    gray: "text-muted",
  };
  return (
    <div className="bg-canvas-soft border border-hairline rounded-md px-4 py-3">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${COLORS[color]}`}>
        {value}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: Tracked["kind"] }) {
  const COLORS = {
    knowledge: "bg-purple-100 text-purple-700",
    document: "bg-blue-100 text-blue-700",
    watch: "bg-cyan-100 text-cyan-700",
  };
  const LABEL = {
    knowledge: "KB",
    document: "Document",
    watch: "Veille",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 font-medium ${COLORS[kind]}`}
    >
      {LABEL[kind]}
    </span>
  );
}

function StatusIcon({
  status,
  isCursor,
}: {
  status: ItemStatus;
  isCursor: boolean;
}) {
  if (status === "done")
    return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />;
  if (status === "error")
    return <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />;
  if (status === "running")
    return (
      <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0 mt-0.5" />
    );
  return (
    <Clock
      className={`w-5 h-5 shrink-0 mt-0.5 ${
        isCursor ? "text-blue-600" : "text-muted-soft"
      }`}
    />
  );
}
