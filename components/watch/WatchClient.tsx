"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Sparkles,
  Telescope,
  AlertCircle,
  AlertTriangle,
  Info,
  FlaskConical,
  BookOpen,
  Building2,
  Heart,
  ExternalLink,
  Clock,
} from "lucide-react";
import { formatDateFr } from "@/lib/dates";
import type { WatchFindingResult } from "@/lib/watch-prompts";

interface Props {
  familyId: string;
  /** Dernière veille générée (peut être null si jamais générée) */
  finding: (WatchFindingResult & {
    id: string;
    generated_at: string;
  }) | null;
}

export default function WatchClient({ familyId, finding }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fraîcheur
  let freshness: "fresh" | "stale" | "old" | null = null;
  let nextAvailableMs: number | null = null;
  if (finding) {
    const ageMs = Date.now() - new Date(finding.generated_at).getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (ageMs < oneWeek) {
      freshness = "fresh";
      nextAvailableMs = oneWeek - ageMs;
    } else if (ageMs < 14 * 24 * 60 * 60 * 1000) {
      freshness = "stale";
    } else {
      freshness = "old";
    }
  }
  const canRefresh = freshness !== "fresh";
  const daysUntilRefresh = nextAvailableMs
    ? Math.ceil(nextAvailableMs / (24 * 60 * 60 * 1000))
    : null;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/watch-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_id: familyId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || "Erreur");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  // ===== État vide =====
  if (!finding) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card-feature text-center py-12 space-y-4">
          <Telescope className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-ink">Veille proactive</h1>
          <p className="text-body max-w-md mx-auto">
            Lance une recherche web pilotée par Claude Opus pour identifier les
            essais cliniques pertinents, publications récentes, centres experts
            et ressources patient adaptés au profil.
          </p>
          <p className="text-xs text-muted">
            La recherche prend 1 à 3 minutes. Refresh limité à 1 fois par semaine.
          </p>
          <button onClick={refresh} disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Recherche en cours…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Lancer la première veille
              </>
            )}
          </button>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-ink">Veille proactive</h1>
          <p className="text-sm text-muted flex items-center gap-2 flex-wrap">
            <Clock className="w-3.5 h-3.5" />
            Générée le {formatDateFr(finding.generated_at)}
            <FreshnessBadge freshness={freshness} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={refresh}
            disabled={loading || !canRefresh}
            className="btn-outline disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Recherche en cours…" : "Rafraîchir"}
          </button>
          {!canRefresh && daysUntilRefresh != null && (
            <span className="text-[11px] text-muted-soft">
              Prochain refresh dans {daysUntilRefresh} jour{daysUntilRefresh > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="card-feature border-error/30 bg-canvas-soft">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Synthèse exécutive */}
      {finding.executive_summary && (
        <ExecutiveSummary
          summary={finding.executive_summary}
          priorities={finding.top_priorities}
        />
      )}

      {/* Alertes contextuelles (prioritaires) */}
      {finding.contextual_alerts && finding.contextual_alerts.length > 0 && (
        <Section
          icon={AlertCircle}
          title="Alertes contextuelles"
          subtitle="Points actionnables spécifiques au profil"
        >
          <div className="space-y-2">
            {finding.contextual_alerts.map((a, i) => (
              <AlertCard key={i} alert={a} />
            ))}
          </div>
        </Section>
      )}

      {/* Essais cliniques */}
      {finding.clinical_trials && finding.clinical_trials.length > 0 && (
        <Section
          icon={FlaskConical}
          title="Essais cliniques"
          subtitle={`${finding.clinical_trials.length} essai${finding.clinical_trials.length > 1 ? "s" : ""} pertinent${finding.clinical_trials.length > 1 ? "s" : ""}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...finding.clinical_trials]
              .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
              .map((t, i) => (
                <TrialCard key={i} trial={t} />
              ))}
          </div>
        </Section>
      )}

      {/* Centres experts */}
      {finding.expert_centers && finding.expert_centers.length > 0 && (
        <Section
          icon={Building2}
          title="Centres experts"
          subtitle="Pour second avis ou RCP nationale"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finding.expert_centers.map((c, i) => (
              <ExpertCenterCard key={i} center={c} />
            ))}
          </div>
        </Section>
      )}

      {/* Publications */}
      {finding.publications && finding.publications.length > 0 && (
        <Section
          icon={BookOpen}
          title="Publications récentes"
          subtitle="Guidelines, revues, résultats d'essais"
        >
          <div className="space-y-2">
            {finding.publications.map((p, i) => (
              <PublicationCard key={i} pub={p} />
            ))}
          </div>
        </Section>
      )}

      {/* Ressources patient */}
      {finding.patient_resources && finding.patient_resources.length > 0 && (
        <Section
          icon={Heart}
          title="Ressources patient"
          subtitle="Associations, livrets, plateformes second avis"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finding.patient_resources.map((r, i) => (
              <ResourceCard key={i} resource={r} />
            ))}
          </div>
        </Section>
      )}

      <p className="text-xs text-muted-soft text-center pt-4 max-w-2xl mx-auto">
        Veille générée par Claude Opus 4.7 avec recherche web. Toutes les
        recommandations sont à valider avec l&apos;équipe médicale. MedPilot ne
        fournit pas d&apos;avis médical.
      </p>
    </div>
  );
}

function priorityRank(p: string | undefined): number {
  if (p === "high") return 3;
  if (p === "medium") return 2;
  return 1;
}

function FreshnessBadge({ freshness }: { freshness: "fresh" | "stale" | "old" | null }) {
  if (!freshness) return null;
  const styles = {
    fresh: { color: "var(--success)", text: "récente" },
    stale: { color: "var(--warning)", text: "à actualiser" },
    old: { color: "var(--error)", text: "périmée" },
  } as const;
  const s = styles[freshness];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
      style={{
        color: s.color,
        backgroundColor: `color-mix(in srgb, ${s.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 35%, transparent)`,
      }}
    >
      {s.text}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Telescope;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2 border-b border-hairline pb-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-base font-medium text-ink">{title}</h2>
        {subtitle && <span className="text-xs text-muted">— {subtitle}</span>}
      </header>
      {children}
    </section>
  );
}

function ExecutiveSummary({
  summary,
  priorities,
}: {
  summary: string;
  priorities: WatchFindingResult["top_priorities"];
}) {
  return (
    <article className="card-feature space-y-4 relative overflow-hidden">
      <div className="orb orb-indigo w-[200px] h-[200px] -top-20 -right-16 opacity-30" />
      <header className="relative z-10 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-base font-medium text-ink">Synthèse</h2>
      </header>
      <p className="text-sm text-body-strong leading-relaxed relative z-10">{summary}</p>
      {priorities && priorities.length > 0 && (
        <div className="relative z-10 space-y-2">
          <h3 className="text-xs font-medium text-ink uppercase tracking-wider">
            Priorités sur 30 jours
          </h3>
          <ol className="space-y-2">
            {priorities.map((p) => (
              <li
                key={p.rank}
                className="flex gap-3 rounded-md border border-hairline bg-canvas p-3"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-medium flex items-center justify-center">
                  {p.rank}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink font-medium">{p.action}</p>
                  <p className="text-xs text-muted mt-0.5">{p.rationale}</p>
                  {p.deadline_suggestion && (
                    <p className="text-[11px] text-primary-deep mt-1">
                      <Clock className="inline w-3 h-3 mr-1" />
                      {p.deadline_suggestion}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

function AlertCard({ alert }: { alert: WatchFindingResult["contextual_alerts"][number] }) {
  const sev = alert.severity ?? "info";
  const palette = {
    critical: { color: "var(--error)", icon: AlertCircle },
    important: { color: "var(--warning)", icon: AlertTriangle },
    info: { color: "var(--primary)", icon: Info },
  } as const;
  const { color, icon: Icon } = palette[sev] ?? palette.info;

  return (
    <article
      className="rounded-lg border bg-canvas p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      <div className="flex gap-3">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <h4 className="text-sm font-medium text-ink">{alert.title}</h4>
          <p className="text-xs text-body leading-relaxed">{alert.rationale}</p>
          <p className="text-xs text-ink">
            <span className="font-medium">À faire : </span>
            {alert.recommended_action}
          </p>
          {alert.source_url && (
            <a
              href={alert.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-deep"
            >
              Source
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function TrialCard({ trial }: { trial: WatchFindingResult["clinical_trials"][number] }) {
  const matchBadge = {
    match: { color: "var(--success)", text: "match" },
    to_verify: { color: "var(--warning)", text: "à vérifier" },
    likely_excluded: { color: "var(--muted)", text: "peu probable" },
  }[trial.eligibility_match];

  return (
    <article className="card-feature space-y-2">
      <header className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="badge-pill">{trial.phase ?? "—"}</span>
          {matchBadge && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
              style={{
                color: matchBadge.color,
                backgroundColor: `color-mix(in srgb, ${matchBadge.color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${matchBadge.color} 35%, transparent)`,
              }}
            >
              {matchBadge.text}
            </span>
          )}
          {trial.nct_id && (
            <span className="text-[10px] text-muted tabular">{trial.nct_id}</span>
          )}
        </div>
        <h4 className="text-sm font-medium text-ink leading-snug">{trial.name}</h4>
        {trial.title && trial.title !== trial.name && (
          <p className="text-[11px] text-muted">{trial.title}</p>
        )}
      </header>
      <p className="text-xs text-body leading-relaxed">{trial.rationale}</p>
      {trial.closest_center && (
        <p className="text-[11px] text-ink-secondary">
          <span className="font-medium">Centre le + proche :</span> {trial.closest_center}
        </p>
      )}
      {trial.eligibility_notes && (
        <p className="text-[11px] text-muted italic">À vérifier : {trial.eligibility_notes}</p>
      )}
      {trial.url && (
        <a
          href={trial.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-deep"
        >
          Voir la fiche
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </article>
  );
}

function PublicationCard({ pub }: { pub: WatchFindingResult["publications"][number] }) {
  return (
    <article className="rounded-lg border border-hairline bg-canvas p-3 space-y-1.5">
      <div className="flex items-baseline gap-2 flex-wrap text-[11px] text-muted">
        {pub.authors_short && <span>{pub.authors_short}</span>}
        {pub.journal && (
          <>
            <span className="text-muted-soft">·</span>
            <span className="italic">{pub.journal}</span>
          </>
        )}
        {pub.year && (
          <>
            <span className="text-muted-soft">·</span>
            <span className="tabular">{pub.year}</span>
          </>
        )}
        {pub.evidence_level && (
          <span className="badge-pill text-[9px]">{pub.evidence_level}</span>
        )}
      </div>
      <h4 className="text-sm font-medium text-ink leading-snug">{pub.title}</h4>
      <p className="text-xs text-body">{pub.key_finding}</p>
      <p className="text-xs text-ink">
        <span className="font-medium">Implication : </span>
        {pub.clinical_implication}
      </p>
      {pub.url && (
        <a
          href={pub.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-deep"
        >
          Lire
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </article>
  );
}

function ExpertCenterCard({
  center,
}: {
  center: WatchFindingResult["expert_centers"][number];
}) {
  return (
    <article className="card-feature space-y-1.5">
      <header className="space-y-0.5">
        <h4 className="text-sm font-medium text-ink">{center.name}</h4>
        <p className="text-[11px] text-muted">
          {[center.city, center.region].filter(Boolean).join(", ")}
          {center.type && (
            <>
              {" · "}
              <span className="text-ink-secondary">{labelType(center.type)}</span>
            </>
          )}
        </p>
      </header>
      {center.specialty_focus && (
        <p className="text-xs text-body">{center.specialty_focus}</p>
      )}
      {center.key_contacts && center.key_contacts.length > 0 && (
        <p className="text-[11px] text-muted">
          <span className="font-medium">Contacts :</span> {center.key_contacts.join(", ")}
        </p>
      )}
      {center.how_to_access && (
        <p className="text-[11px] text-muted-soft italic">{center.how_to_access}</p>
      )}
      {center.distance_estimate_from_patient && (
        <p className="text-[11px] text-ink-secondary">
          {center.distance_estimate_from_patient}
        </p>
      )}
      {center.url && (
        <a
          href={center.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-deep"
        >
          Site officiel
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </article>
  );
}

function ResourceCard({
  resource,
}: {
  resource: WatchFindingResult["patient_resources"][number];
}) {
  return (
    <article className="rounded-lg border border-hairline bg-canvas p-3 space-y-1.5">
      <header className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-ink">{resource.name}</h4>
        {resource.type && (
          <span className="text-[10px] text-muted-soft uppercase tracking-wider">
            {resource.type.replace("_", " ")}
          </span>
        )}
      </header>
      <p className="text-xs text-body">{resource.description}</p>
      {resource.quality_signal && (
        <p className="text-[11px] text-muted">
          <span className="font-medium">Qualité :</span> {resource.quality_signal}
        </p>
      )}
      {resource.url && (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-deep"
        >
          Ouvrir
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </article>
  );
}

function labelType(t: string): string {
  switch (t) {
    case "national_reference":
      return "centre de référence national";
    case "international_reference":
      return "référence internationale";
    case "regional_expert":
      return "expert régional";
    default:
      return t;
  }
}
