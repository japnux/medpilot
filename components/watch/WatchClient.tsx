"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  AlertOctagon,
  X,
} from "lucide-react";
import { formatDateFr } from "@/lib/dates";
import type { WatchFindingResult } from "@/lib/watch-prompts";
import {
  WATCH_TABS,
  type WatchTabId,
  getTabItemCount,
  getCriticalAlertsCount,
} from "@/lib/watch-sections";

/** Lien externe protégé : ne rend rien si url invalide. */
function SafeLink({
  url,
  label,
  className,
}: {
  url?: string | null;
  label?: string;
  className?: string;
}) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#" || !/^https?:\/\//i.test(trimmed)) return null;
  return (
    <a
      href={trimmed}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-deep"
      }
    >
      {label ?? "Voir"}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

/** Extrait une URL d'un item Claude (peut être dans .url, .source_url, .link, .contact). */
function pickUrl(item: Record<string, unknown>): string | null {
  for (const key of ["url", "source_url", "link", "contact", "href"]) {
    const v = item[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return null;
}

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tab actif via URL
  const tabParam = searchParams.get("tab") as WatchTabId | null;
  const validTabIds = WATCH_TABS.map((t) => t.id);
  const activeTab: WatchTabId =
    tabParam && validTabIds.includes(tabParam) ? tabParam : "synthese";

  function selectTab(t: WatchTabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", t);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

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

  const criticalCount = getCriticalAlertsCount(finding);
  const currentTab = WATCH_TABS.find((t) => t.id === activeTab) ?? WATCH_TABS[0];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <span className="badge-pill">🔭 Veille</span>
          <h1 className="text-ink">Veille proactive</h1>
          <p className="text-sm text-muted flex items-center gap-2 flex-wrap">
            <Clock className="w-3.5 h-3.5" />
            Générée le {formatDateFr(finding.generated_at)}
            <FreshnessBadge freshness={freshness} />
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2 flex-wrap justify-end">
            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-colors"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--warning) 12%, transparent)",
                  color: "var(--warning)",
                  border:
                    "1px solid color-mix(in srgb, var(--warning) 35%, transparent)",
                }}
              >
                <AlertOctagon className="w-4 h-4" />
                {criticalCount} alerte{criticalCount > 1 ? "s" : ""} critique
                {criticalCount > 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={refresh}
              disabled={loading || !canRefresh}
              className="btn-outline disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Recherche…" : "Rafraîchir"}
            </button>
          </div>
          {!canRefresh && daysUntilRefresh != null && (
            <span className="text-[11px] text-muted-soft">
              Prochain refresh dans {daysUntilRefresh} jour
              {daysUntilRefresh > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="card-feature border-error/30 bg-canvas-soft">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Tabs nav (pills, wrap, pas de scroll) */}
      <nav className="flex flex-wrap gap-2">
        {WATCH_TABS.map((t) => {
          const count = getTabItemCount(t.id, finding);
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                active
                  ? "bg-ink text-canvas border-ink"
                  : "bg-canvas-soft text-body border-hairline hover:bg-surface-card hover:text-ink"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={`text-[10px] tabular px-1.5 py-0.5 rounded-full ${
                    active
                      ? "bg-canvas/20 text-canvas"
                      : "bg-canvas text-muted border border-hairline"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Contenu du tab actif */}
      <div className="space-y-4">
        {currentTab.sections.map((sec) => (
          <SectionRenderer
            key={sec}
            sectionId={sec}
            finding={finding}
            onSwitchTab={selectTab}
          />
        ))}
      </div>

      <p className="text-xs text-muted-soft text-center pt-4 max-w-2xl mx-auto">
        Veille générée par Claude Opus 4.7 avec recherche web. Toutes les
        recommandations sont à valider avec l&apos;équipe médicale. MedPilot ne
        fournit pas d&apos;avis médical.
      </p>

      {/* Drawer critical alerts */}
      {drawerOpen && (
        <CriticalAlertsDrawer
          alerts={(finding.contextual_alerts ?? []).filter(
            (a) => a.severity === "critical",
          )}
          onClose={() => setDrawerOpen(false)}
          onSeeAll={() => {
            setDrawerOpen(false);
            selectTab("actions");
          }}
        />
      )}
    </div>
  );
}

// ===================== Section renderer =====================

function SectionRenderer({
  sectionId,
  finding,
  onSwitchTab,
}: {
  sectionId: string;
  finding: WatchFindingResult;
  onSwitchTab: (t: WatchTabId) => void;
}) {
  switch (sectionId) {
    case "executive_summary":
      if (!finding.executive_summary) return null;
      return (
        <article className="card-feature space-y-3 relative overflow-hidden">
          <div className="orb orb-indigo w-[200px] h-[200px] -top-20 -right-16 opacity-30" />
          <header className="relative z-10 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-base font-medium text-ink">Synthèse</h2>
          </header>
          <p className="text-sm text-body-strong leading-relaxed relative z-10">
            {finding.executive_summary}
          </p>
        </article>
      );

    case "top_priorities":
      if (!finding.top_priorities || finding.top_priorities.length === 0) return null;
      return (
        <article className="card-feature space-y-3">
          <header className="flex items-center gap-2">
            <h2 className="text-base font-medium text-ink">
              Priorités sur 30 jours
            </h2>
          </header>
          <ol className="space-y-2">
            {finding.top_priorities.map((p) => (
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
        </article>
      );

    case "contextual_alerts":
      if (!finding.contextual_alerts || finding.contextual_alerts.length === 0)
        return null;
      return (
        <Section
          icon={AlertCircle}
          title="Alertes contextuelles"
          count={finding.contextual_alerts.length}
          defaultOpen
        >
          <div className="space-y-2">
            {finding.contextual_alerts.map((a, i) => (
              <AlertCard key={i} alert={a} />
            ))}
          </div>
        </Section>
      );

    case "clinical_trials":
      if (!finding.clinical_trials || finding.clinical_trials.length === 0)
        return null;
      return (
        <Section
          icon={FlaskConical}
          title="Essais cliniques"
          count={finding.clinical_trials.length}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...finding.clinical_trials]
              .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
              .map((t, i) => (
                <TrialCard key={i} trial={t} />
              ))}
          </div>
        </Section>
      );

    case "expert_centers":
      if (!finding.expert_centers || finding.expert_centers.length === 0)
        return null;
      return (
        <Section
          icon={Building2}
          title="Centres experts"
          count={finding.expert_centers.length}
          defaultOpen
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finding.expert_centers.map((c, i) => (
              <ExpertCenterCard key={i} center={c} />
            ))}
          </div>
        </Section>
      );

    case "patient_resources": {
      const valid = (finding.patient_resources ?? []).filter(
        (r) => r && (r.name || r.description || r.url),
      );
      if (valid.length === 0) return null;
      return (
        <Section
          icon={Heart}
          title="Ressources patient"
          count={valid.length}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {valid.map((r, i) => (
              <ResourceCard key={i} resource={r} />
            ))}
          </div>
        </Section>
      );
    }

    case "publications":
      if (!finding.publications || finding.publications.length === 0) return null;
      return (
        <Section
          icon={BookOpen}
          title="Publications récentes"
          count={finding.publications.length}
          defaultOpen
        >
          <div className="space-y-2">
            {finding.publications.map((p, i) => (
              <PublicationCard key={i} pub={p} />
            ))}
          </div>
        </Section>
      );

    default:
      return null;
  }
}

// ===================== Section accordion =====================

function Section({
  icon: Icon,
  title,
  count,
  defaultOpen = false,
  children,
}: {
  icon: typeof AlertCircle;
  title: string;
  count?: number | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="card-feature p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-canvas-soft transition-colors text-left"
      >
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <h2 className="text-base font-medium text-ink flex-1">{title}</h2>
        {count != null && count > 0 && (
          <span className="text-[11px] tabular text-muted bg-canvas-soft border border-hairline px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-hairline">{children}</div>}
    </article>
  );
}

// ===================== Critical alerts drawer =====================

function CriticalAlertsDrawer({
  alerts,
  onClose,
  onSeeAll,
}: {
  alerts: WatchFindingResult["contextual_alerts"];
  onClose: () => void;
  onSeeAll: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-ink/40"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Alertes critiques"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-canvas shadow-2xl flex flex-col"
      >
        <header className="px-5 py-4 border-b border-hairline bg-warning/5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-warning" />
              <h2 className="text-base font-medium text-ink">Alertes critiques</h2>
            </div>
            <p className="text-xs text-muted mt-1">
              Actions prioritaires à mener
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-surface-card text-muted hover:text-ink flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted italic">
              Pas d&apos;alerte critique active.
            </p>
          ) : (
            alerts.map((a, i) => <AlertCard key={i} alert={a} />)
          )}
        </div>
        <footer className="px-5 py-3 border-t border-hairline bg-canvas-soft">
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs text-primary hover:text-primary-deep"
          >
            Voir toutes les alertes dans « Actions à mener » →
          </button>
        </footer>
      </aside>
    </>
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
          <SafeLink url={pickUrl(alert as unknown as Record<string, unknown>)} label="Source" />
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
      <SafeLink url={pickUrl(trial as unknown as Record<string, unknown>)} label="Voir la fiche" />
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
      <SafeLink url={pickUrl(pub as unknown as Record<string, unknown>)} label="Lire" />
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
      {(() => {
        // key_contacts peut arriver en string ou array (selon Claude)
        const kc = center.key_contacts as unknown;
        let label: string | null = null;
        if (Array.isArray(kc) && kc.length > 0) {
          label = kc.filter((x) => typeof x === "string" && x.trim()).join(", ");
        } else if (typeof kc === "string" && kc.trim()) {
          label = kc.trim();
        }
        return label ? (
          <p className="text-[11px] text-muted">
            <span className="font-medium">Contacts :</span> {label}
          </p>
        ) : null;
      })()}
      {center.how_to_access && (
        <p className="text-[11px] text-muted-soft italic">{center.how_to_access}</p>
      )}
      {center.distance_estimate_from_patient && (
        <p className="text-[11px] text-ink-secondary">
          {center.distance_estimate_from_patient}
        </p>
      )}
      <SafeLink url={pickUrl(center as unknown as Record<string, unknown>)} label="Site officiel" />
    </article>
  );
}

function ResourceCard({
  resource,
}: {
  resource: WatchFindingResult["patient_resources"][number];
}) {
  const url = pickUrl(resource as unknown as Record<string, unknown>);
  const services = (resource as unknown as { services?: string }).services;
  return (
    <article className="rounded-lg border border-hairline bg-canvas p-3 space-y-1.5">
      <header className="flex items-center gap-2 flex-wrap">
        <h4 className="text-sm font-medium text-ink">{resource.name}</h4>
        {resource.type && (
          <span className="text-[10px] text-muted-soft uppercase tracking-wider">
            {resource.type.replace("_", " ")}
          </span>
        )}
      </header>
      {resource.description && <p className="text-xs text-body">{resource.description}</p>}
      {services && <p className="text-xs text-body">{services}</p>}
      {resource.quality_signal && (
        <p className="text-[11px] text-muted">
          <span className="font-medium">Qualité :</span> {resource.quality_signal}
        </p>
      )}
      <SafeLink url={url} label="Ouvrir" />
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
