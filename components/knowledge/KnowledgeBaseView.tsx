"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Users,
  Layers,
  Microscope,
  Pill,
  FlaskConical,
  CalendarCheck,
  Activity,
  Dna,
  Heart,
  HelpCircle,
  Newspaper,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";

/**
 * Lien externe protégé : ne rend rien si url manquante / vide / # / not http(s).
 * Évite "this page couldn't load" sur les <a href=""> que produit Claude
 * quand il n'a pas trouvé de source pour un item.
 */
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
        "text-[11px] text-primary hover:text-primary-deep inline-flex items-center gap-1"
      }
    >
      {label ?? "Source"}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
import type { CancerKnowledge } from "@/lib/knowledge-prompts";
import { formatDateFr } from "@/lib/dates";

interface KbProps {
  cancerType: string;
  cancerTypeLabel: string;
  status: "generating" | "ready" | "failed" | "stale";
  generatedAt: string;
  version: number;
  data: CancerKnowledge;
}

/**
 * Vue unifiée de la knowledge base d'un cancer.
 * Section "Red Flags" mise en avant en tête. Les 13 autres sections sont des
 * accordéons collapsibles. Tout est sourcé en footer.
 */
export default function KnowledgeBaseView({
  cancerType,
  cancerTypeLabel,
  status,
  generatedAt,
  version,
  data,
}: KbProps) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/generate-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancer_type: cancerType,
          cancer_type_label: cancerTypeLabel,
          force: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur");
      // Polling pas implémenté : la régénération est synchrone côté serveur (3min max)
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRegenerating(false);
    }
  }

  // ===== États non-ready =====
  if (status === "generating") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <article className="card-feature text-center py-16 space-y-3 relative overflow-hidden">
          <div className="orb orb-indigo w-[260px] h-[260px] -top-24 -right-20" />
          <Sparkles className="w-8 h-8 text-primary mx-auto animate-pulse relative z-10" />
          <h1 className="text-ink relative z-10">Génération en cours</h1>
          <p className="text-sm text-muted max-w-md mx-auto relative z-10">
            Claude Opus 4.7 explore le web (sociétés savantes, PubMed,
            ClinicalTrials.gov) pour construire la fiche {cancerTypeLabel}.
            Cela prend 1 à 3 minutes.
          </p>
          <button
            onClick={() => router.refresh()}
            className="btn-outline relative z-10"
          >
            <RefreshCw className="w-4 h-4" />
            Vérifier l&apos;état
          </button>
        </article>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <article className="card-feature text-center py-12 space-y-3">
          <AlertOctagon className="w-8 h-8 text-error mx-auto" />
          <h1 className="text-ink">Génération échouée</h1>
          <p className="text-sm text-muted">
            La création de la fiche {cancerTypeLabel} a échoué. Vous pouvez
            réessayer.
          </p>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="btn-primary"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Relance..." : "Réessayer"}
          </button>
        </article>
      </div>
    );
  }

  const redFlags = data.red_flags ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="badge-pill">Fiche cancer</span>
          </div>
          <h1 className="text-ink">{cancerTypeLabel}</h1>
          <p className="text-xs text-muted">
            Version {version} · Générée le {formatDateFr(generatedAt)}
            {status === "stale" && " · ⚠️ À actualiser"}
          </p>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="btn-outline disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Régénération..." : "Régénérer"}
        </button>
      </header>

      {error && <p className="text-sm text-error">{error}</p>}

      {/* Red flags : mise en avant prioritaire */}
      {redFlags.length > 0 && (
        <article className="rounded-xl border border-error/40 bg-error/5 p-5 space-y-3">
          <header className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-error" />
            <h2 className="text-base font-medium text-ink">
              Signes d&apos;alerte — appeler le 15 ou l&apos;équipe d&apos;astreinte
            </h2>
          </header>
          <ul className="space-y-2">
            {redFlags.map((rf, i) => (
              <li
                key={i}
                className="rounded-md border border-error/20 bg-canvas p-3 flex gap-3"
              >
                <SeverityIcon severity={rf.severity} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium text-ink">{rf.symptom_or_sign}</p>
                  {rf.context && (
                    <p className="text-xs text-muted italic">Contexte : {rf.context}</p>
                  )}
                  {rf.action && (
                    <p className="text-xs text-ink">
                      <span className="font-medium">À faire :</span> {rf.action}
                    </p>
                  )}
                  {rf.rationale && (
                    <p className="text-[11px] text-muted">{rf.rationale}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </article>
      )}

      {/* Overview */}
      <Section icon={Info} title="Vue d'ensemble" defaultOpen>
        <OverviewBlock overview={data.overview} />
      </Section>

      <Section icon={Layers} title="Stadification & classification">
        <StagingBlock staging={data.staging_classification} />
      </Section>

      <Section icon={Microscope} title="Biomarqueurs">
        <BiomarkersBlock biomarkers={data.biomarkers ?? []} />
      </Section>

      <Section icon={Pill} title="Protocoles standards">
        <ProtocolsBlock protocols={data.standard_protocols ?? []} />
      </Section>

      <Section icon={FlaskConical} title="Paysage des essais cliniques">
        <TrialsBlock trials={data.clinical_trials_landscape ?? []} />
      </Section>

      <Section icon={CalendarCheck} title="Surveillance recommandée">
        <SurveillanceBlock surv={data.surveillance_recommendations} />
      </Section>

      <Section icon={Activity} title="Effets indésirables à surveiller">
        <SideEffectsBlock effects={data.side_effects_to_monitor ?? []} />
      </Section>

      <Section icon={Dna} title="Considérations génétiques">
        <GeneticsBlock genetics={data.genetic_considerations} />
      </Section>

      <Section icon={Users} title="Réseau d'experts">
        <ExpertNetworkBlock network={data.expert_network ?? []} />
      </Section>

      <Section icon={Heart} title="Ressources patient">
        <ResourcesBlock resources={data.patient_resources ?? []} />
      </Section>

      <Section icon={HelpCircle} title="Questions clés à poser à l'équipe">
        <QuestionsBlock questions={data.key_questions_for_team ?? []} />
      </Section>

      <Section icon={Newspaper} title="Évolutions récentes">
        <UpdatesBlock updates={data.recent_updates ?? []} />
      </Section>

      <p className="text-xs text-muted-soft text-center pt-4 max-w-2xl mx-auto">
        Cette fiche est un référentiel généré par Claude Opus 4.7 avec recherche
        web. À valider par l&apos;équipe médicale. MedPilot ne fournit pas
        d&apos;avis médical.
      </p>
    </div>
  );
}

// ===================== Composants section =====================

function Section({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: typeof Info;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="card-feature p-0 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-canvas-soft transition-colors text-left"
      >
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <h2 className="text-base font-medium text-ink flex-1">{title}</h2>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-hairline">{children}</div>
      )}
    </article>
  );
}

function SeverityIcon({ severity }: { severity?: string }) {
  if (severity === "vital") return <AlertOctagon className="w-4 h-4 text-error shrink-0 mt-0.5" />;
  if (severity === "urgent") return <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />;
  return <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />;
}

function NoteFallback({ note }: { note?: string }) {
  if (!note) return <p className="text-xs text-muted italic">Information non disponible.</p>;
  return <p className="text-xs text-muted italic">{note}</p>;
}

function OverviewBlock({ overview }: { overview: CancerKnowledge["overview"] }) {
  if (!overview || (!overview.description && !overview.key_facts?.length)) {
    return <NoteFallback note={overview?._note} />;
  }
  return (
    <div className="space-y-3 mt-2">
      {overview.description && <p className="text-sm text-body-strong">{overview.description}</p>}
      {overview.epidemiology && (
        <p className="text-xs text-muted">
          <span className="font-medium text-ink">Épidémiologie : </span>
          {overview.epidemiology}
        </p>
      )}
      {overview.subtypes && overview.subtypes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink mb-1">Sous-types</p>
          <ul className="flex flex-wrap gap-1.5">
            {overview.subtypes.map((s, i) => (
              <li key={i} className="badge-pill">{s}</li>
            ))}
          </ul>
        </div>
      )}
      {overview.key_facts && overview.key_facts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink mb-1">Points clés</p>
          <ul className="space-y-1 pl-4 list-disc text-xs text-body">
            {overview.key_facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StagingBlock({ staging }: { staging: CancerKnowledge["staging_classification"] }) {
  if (!staging || (!staging.primary_system && !staging.stages_summary?.length)) {
    return <NoteFallback note={staging?._note} />;
  }
  return (
    <div className="space-y-3 mt-2">
      {staging.primary_system && (
        <p className="text-sm text-ink">
          <span className="font-medium">Système principal :</span> {staging.primary_system}
        </p>
      )}
      {staging.stages_summary && staging.stages_summary.length > 0 && (
        <div className="space-y-1.5">
          {staging.stages_summary.map((s, i) => (
            <div key={i} className="rounded border border-hairline bg-canvas p-2.5">
              <p className="text-xs font-medium text-ink">Stade {s.stage}</p>
              <p className="text-xs text-body mt-0.5">{s.description}</p>
              {s.typical_treatment && (
                <p className="text-[11px] text-muted mt-0.5">
                  <span className="font-medium">Tx type :</span> {s.typical_treatment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {staging.risk_stratification && (
        <p className="text-xs text-body">
          <span className="font-medium text-ink">Facteurs de risque : </span>
          {staging.risk_stratification}
        </p>
      )}
      {staging.secondary_systems && staging.secondary_systems.length > 0 && (
        <p className="text-xs text-muted">
          <span className="font-medium text-ink">Autres classifications : </span>
          {staging.secondary_systems.join(", ")}
        </p>
      )}
    </div>
  );
}

function BiomarkersBlock({ biomarkers }: { biomarkers: CancerKnowledge["biomarkers"] }) {
  if (biomarkers.length === 0) return <NoteFallback />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
      {biomarkers.map((b, i) => (
        <div key={i} className="rounded border border-hairline bg-canvas p-3 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">{b.name}</p>
            {b.type && <span className="badge-pill text-[9px]">{b.type}</span>}
          </div>
          {b.clinical_significance && (
            <p className="text-xs text-body">{b.clinical_significance}</p>
          )}
          {b.reference_values && (
            <p className="text-[11px] text-muted tabular">
              <span className="font-medium">Réf : </span>{b.reference_values}
            </p>
          )}
          {b.treatment_implications && (
            <p className="text-[11px] text-ink-secondary">
              <span className="font-medium">Impact tx : </span>{b.treatment_implications}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ProtocolsBlock({ protocols }: { protocols: CancerKnowledge["standard_protocols"] }) {
  if (protocols.length === 0) return <NoteFallback />;
  return (
    <div className="space-y-2 mt-2">
      {protocols.map((p, i) => (
        <div key={i} className="rounded border border-hairline bg-canvas p-3 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-medium text-ink">{p.stage_or_situation}</p>
            {p.treatment_line && <span className="badge-pill text-[9px]">{p.treatment_line}</span>}
          </div>
          {p.protocol_name && (
            <p className="text-xs text-body">
              <span className="font-medium text-ink">Protocole : </span>{p.protocol_name}
            </p>
          )}
          {p.components && p.components.length > 0 && (
            <p className="text-xs text-body">
              <span className="font-medium text-ink">Composants : </span>
              {p.components.join(", ")}
            </p>
          )}
          {p.rationale && <p className="text-[11px] text-muted">{p.rationale}</p>}
          {p.pivot_trial && (
            <p className="text-[11px] text-ink-secondary">
              <span className="font-medium">Essai pivot : </span>{p.pivot_trial}
            </p>
          )}
          {/* Lien direct si Claude a sourcé un URL ou pivot_trial_url */}
          <SafeLink
            url={(p as unknown as { url?: string; pivot_trial_url?: string }).url ??
              (p as unknown as { pivot_trial_url?: string }).pivot_trial_url}
            label="Source"
          />
        </div>
      ))}
    </div>
  );
}

function TrialsBlock({ trials }: { trials: CancerKnowledge["clinical_trials_landscape"] }) {
  if (trials.length === 0) return <NoteFallback />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
      {trials.map((t, i) => (
        <div key={i} className="rounded border border-hairline bg-canvas p-3 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-ink">{t.name}</p>
            {t.phase && <span className="badge-pill text-[9px]">{t.phase}</span>}
            {t.status && <span className="text-[10px] text-muted-soft uppercase">{t.status}</span>}
          </div>
          {t.nct_id && <p className="text-[11px] text-muted tabular">{t.nct_id}</p>}
          {t.context && <p className="text-xs text-body">{t.context}</p>}
          {t.rationale && <p className="text-[11px] text-muted">{t.rationale}</p>}
          <SafeLink url={t.url} label="Voir" />
        </div>
      ))}
    </div>
  );
}

function SurveillanceBlock({
  surv,
}: {
  surv: CancerKnowledge["surveillance_recommendations"];
}) {
  if (!surv || (!surv.post_treatment_curative && !surv.key_milestones?.length)) {
    return <NoteFallback note={surv?._note} />;
  }
  const post = surv.post_treatment_curative;
  return (
    <div className="space-y-3 mt-2">
      {post && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {post.imaging && (
            <p className="text-xs text-body rounded border border-hairline bg-canvas p-2">
              <span className="font-medium text-ink">Imagerie : </span>{post.imaging}
            </p>
          )}
          {post.biology && (
            <p className="text-xs text-body rounded border border-hairline bg-canvas p-2">
              <span className="font-medium text-ink">Biologie : </span>{post.biology}
            </p>
          )}
          {post.clinical_exam && (
            <p className="text-xs text-body rounded border border-hairline bg-canvas p-2">
              <span className="font-medium text-ink">Clinique : </span>{post.clinical_exam}
            </p>
          )}
          {post.duration && (
            <p className="text-xs text-body rounded border border-hairline bg-canvas p-2">
              <span className="font-medium text-ink">Durée : </span>{post.duration}
            </p>
          )}
        </div>
      )}
      {surv.key_milestones && surv.key_milestones.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink">Jalons clés</p>
          {surv.key_milestones.map((m, i) => (
            <div key={i} className="rounded border border-hairline bg-canvas p-2">
              <p className="text-xs font-medium text-ink">{m.time}</p>
              <ul className="pl-4 list-disc text-[11px] text-body mt-0.5">
                {m.checks.map((c, j) => (
                  <li key={j}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SideEffectsBlock({ effects }: { effects: CancerKnowledge["side_effects_to_monitor"] }) {
  if (effects.length === 0) return <NoteFallback />;
  return (
    <div className="space-y-2 mt-2">
      {effects.map((e, i) => (
        <div key={i} className="rounded border border-hairline bg-canvas p-3 space-y-1">
          <p className="text-sm font-medium text-ink">{e.treatment}</p>
          {e.common_effects && e.common_effects.length > 0 && (
            <p className="text-xs text-body">
              <span className="font-medium">Fréquents : </span>
              {e.common_effects.join(", ")}
            </p>
          )}
          {e.serious_effects && e.serious_effects.length > 0 && (
            <p className="text-xs text-warning">
              <span className="font-medium">Graves : </span>
              {e.serious_effects.join(", ")}
            </p>
          )}
          {e.monitoring_required && (
            <p className="text-[11px] text-muted">
              <span className="font-medium text-ink">Surveillance : </span>{e.monitoring_required}
            </p>
          )}
          {e.patient_advice && (
            <p className="text-[11px] text-ink-secondary italic">{e.patient_advice}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function GeneticsBlock({ genetics }: { genetics: CancerKnowledge["genetic_considerations"] }) {
  if (
    !genetics ||
    (!genetics.germline_predispositions &&
      !genetics.indications_for_testing &&
      !genetics.family_screening_implications)
  ) {
    return <NoteFallback note={genetics?._note} />;
  }
  return (
    <div className="space-y-2 mt-2 text-xs text-body">
      {genetics.germline_predispositions && (
        <p>
          <span className="font-medium text-ink">Prédispositions germinales : </span>
          {genetics.germline_predispositions}
        </p>
      )}
      {genetics.indications_for_testing && (
        <p>
          <span className="font-medium text-ink">Indications de test : </span>
          {genetics.indications_for_testing}
        </p>
      )}
      {genetics.family_screening_implications && (
        <p>
          <span className="font-medium text-ink">Implications familiales : </span>
          {genetics.family_screening_implications}
        </p>
      )}
      {genetics.referral_pathway && (
        <p>
          <span className="font-medium text-ink">Circuit de référence : </span>
          {genetics.referral_pathway}
        </p>
      )}
    </div>
  );
}

function ExpertNetworkBlock({ network }: { network: CancerKnowledge["expert_network"] }) {
  if (network.length === 0) return <NoteFallback />;
  return (
    <div className="space-y-2 mt-2">
      {network.map((n, i) => (
        <div key={i} className="rounded border border-hairline bg-canvas p-3 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-medium text-ink">{n.name}</p>
            {n.type && (
              <span className="text-[10px] text-muted-soft uppercase tracking-wider">
                {n.type.replace("_", " ")}
              </span>
            )}
          </div>
          {n.coordinator && (
            <p className="text-xs text-body">
              <span className="font-medium text-ink">Coordinateur : </span>{n.coordinator}
            </p>
          )}
          {n.scope && <p className="text-xs text-body">{n.scope}</p>}
          <div className="flex gap-3 flex-wrap">
            <SafeLink url={n.url} label="Site" />
            <SafeLink url={n.centers_list_url} label="Liste centres" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ResourcesBlock({ resources }: { resources: CancerKnowledge["patient_resources"] }) {
  if (resources.length === 0) return <NoteFallback />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
      {resources.map((r, i) => {
        // Tolère un champ "contact" en plus de "url" (sortie Haiku)
        const url =
          r.url ?? (r as unknown as { contact?: string }).contact ?? null;
        return (
          <div key={i} className="rounded border border-hairline bg-canvas p-3 space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-sm font-medium text-ink">{r.name}</p>
              {r.type && (
                <span className="text-[10px] text-muted-soft uppercase">
                  {r.type.replace("_", " ")}
                </span>
              )}
            </div>
            {r.description && <p className="text-xs text-body">{r.description}</p>}
            {(r as unknown as { services?: string }).services && (
              <p className="text-xs text-body">
                {(r as unknown as { services?: string }).services}
              </p>
            )}
            {r.quality_signal && (
              <p className="text-[11px] text-muted">
                <span className="font-medium text-ink">Qualité : </span>{r.quality_signal}
              </p>
            )}
            <SafeLink url={url} label="Ouvrir" />
          </div>
        );
      })}
    </div>
  );
}

function QuestionsBlock({ questions }: { questions: CancerKnowledge["key_questions_for_team"] }) {
  if (questions.length === 0) return <NoteFallback />;
  const stageLabels: Record<string, string> = {
    diagnosis: "Diagnostic",
    treatment_decision: "Décision thérapeutique",
    during_treatment: "Pendant traitement",
    surveillance: "Surveillance",
    recurrence: "Récidive",
  };
  return (
    <div className="space-y-3 mt-2">
      {questions.map((q, i) => (
        <div key={i} className="rounded border border-hairline bg-canvas p-3">
          <p className="text-xs font-medium text-ink mb-1.5 uppercase tracking-wider">
            {stageLabels[q.stage] ?? q.stage}
          </p>
          <ul className="space-y-1 pl-4 list-disc text-xs text-body">
            {q.questions.map((qu, j) => (
              <li key={j}>{qu}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function UpdatesBlock({ updates }: { updates: CancerKnowledge["recent_updates"] }) {
  if (updates.length === 0) return <NoteFallback />;
  return (
    <div className="space-y-2 mt-2">
      {updates.map((u, i) => (
        <div key={i} className="rounded border border-hairline bg-canvas p-3 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            {u.year && <span className="text-[11px] text-muted tabular">{u.year}</span>}
            <p className="text-sm font-medium text-ink">{u.title}</p>
            {u.impact_level && <span className="badge-pill text-[9px]">{u.impact_level}</span>}
          </div>
          {u.summary && <p className="text-xs text-body">{u.summary}</p>}
          <SafeLink url={u.source_url} label="Source" />
        </div>
      ))}
    </div>
  );
}
