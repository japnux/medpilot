"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ThumbsUp,
  AlertCircle,
  Lightbulb,
  RefreshCw,
} from "lucide-react";

interface TrendsResult {
  overall: string;
  favorable: string[];
  concerning: string[];
  recommendations: string[];
  highlights: Array<{
    marker_label: string;
    trend: "up" | "down" | "stable";
    note: string;
  }>;
  cached?: boolean;
  generated_at?: string;
  empty?: boolean;
}

interface Props {
  familyId: string;
}

/**
 * Carte d'analyse IA des tendances biologiques.
 * - Charge depuis le cache au premier affichage
 * - Bouton "Régénérer" pour forcer une nouvelle analyse
 * - Cache invalidé automatiquement quand un nouveau bilan arrive
 */
export default function BiologyTrendsCard({ familyId }: Props) {
  const [data, setData] = useState<TrendsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load(force = false) {
    if (force) setGenerating(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/biology/analyze-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_id: familyId, force }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur");
      setData(j as TrendsResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  if (loading) {
    return (
      <div className="card-feature flex items-center gap-3 text-sm text-muted">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Chargement de l&apos;analyse...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-feature">
        <p className="text-sm text-error">Erreur : {error}</p>
        <button onClick={() => load(true)} className="mt-2 btn-outline text-xs h-8 px-3">
          Réessayer
        </button>
      </div>
    );
  }

  if (!data || data.empty) {
    return (
      <div className="card-feature text-center py-6">
        <Sparkles className="w-5 h-5 text-muted-soft mx-auto mb-2" />
        <p className="text-sm text-muted">
          Pas encore de bilan biologique. Analysez un compte-rendu dans Analyser pour
          alimenter la synthèse IA.
        </p>
      </div>
    );
  }

  return (
    <article className="card-feature space-y-4 relative overflow-hidden">
      {/* Orb décoratif léger */}
      <div className="orb orb-mint w-[200px] h-[200px] -top-20 -right-16 opacity-30" />

      <header className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ink" />
          <h2 className="text-base font-medium text-ink">Lecture des tendances</h2>
          {data.cached && (
            <span className="badge-pill">cache</span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={generating}
          className="text-xs text-muted hover:text-ink flex items-center gap-1 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Génération..." : "Régénérer"}
        </button>
      </header>

      {/* Synthèse globale */}
      <p className="text-sm text-body-strong leading-relaxed relative z-10">
        {data.overall}
      </p>

      {/* Highlights */}
      {data.highlights && data.highlights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 relative z-10">
          {data.highlights.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md border border-hairline bg-canvas-soft p-2.5"
            >
              <TrendIcon trend={h.trend} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink">{h.marker_label}</p>
                <p className="text-[11px] text-muted leading-snug mt-0.5">{h.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Favorables / Préoccupants */}
      {(data.favorable.length > 0 || data.concerning.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
          {data.favorable.length > 0 && (
            <Section icon={ThumbsUp} title="Favorable" items={data.favorable} tone="success" />
          )}
          {data.concerning.length > 0 && (
            <Section icon={AlertCircle} title="À surveiller" items={data.concerning} tone="warning" />
          )}
        </div>
      )}

      {/* Recommandations */}
      {data.recommendations.length > 0 && (
        <Section
          icon={Lightbulb}
          title="Recommandations"
          items={data.recommendations}
          tone="neutral"
        />
      )}
    </article>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  const cls = "w-4 h-4 shrink-0 mt-0.5";
  if (trend === "up") return <TrendingUp className={cls} style={{ color: "var(--warning)" }} />;
  if (trend === "down") return <TrendingDown className={cls} style={{ color: "var(--success)" }} />;
  return <Minus className={cls} style={{ color: "var(--muted)" }} />;
}

function Section({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof ThumbsUp;
  title: string;
  items: string[];
  tone: "success" | "warning" | "neutral";
}) {
  const color =
    tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : "var(--ink)";
  return (
    <section className="space-y-1.5 relative z-10">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs font-medium" style={{ color }}>
          {title}
        </span>
      </div>
      <ul className="space-y-1 pl-5">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-body list-disc">
            {it}
          </li>
        ))}
      </ul>
    </section>
  );
}
