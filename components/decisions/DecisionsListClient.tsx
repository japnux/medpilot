"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formatDateFr } from "@/lib/dates";
import {
  getCategoryMeta,
  type DecisionRow,
  type DecisionStatus,
} from "@/lib/decisions";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  FileText,
  GitBranch,
  Mailbox,
  Stethoscope,
  Telescope,
  Users,
} from "lucide-react";
import DecideDecisionModal from "./DecideDecisionModal";
import UrgencyBadge from "./UrgencyBadge";

interface SourceMap {
  documents: Record<string, { title: string; document_date: string | null }>;
  consultations: Record<
    string,
    { consultation_type: string; consultation_date: string }
  >;
}

interface UpcomingConsultation {
  id: string;
  consultation_date: string;
  consultation_type: string | null;
  doctor_name: string | null;
}

interface Props {
  decisions: DecisionRow[];
  sources: SourceMap;
  upcomingConsultations: UpcomingConsultation[];
}

type Filter =
  | "urgent"
  | "pending"
  | "awaiting_team"
  | "awaiting_result"
  | "obsolete_flagged"
  | "decided"
  | "all";

interface TabDef {
  id: Filter;
  label: string;
}

const TABS: TabDef[] = [
  { id: "urgent", label: "Urgentes" },
  { id: "pending", label: "À trancher" },
  { id: "awaiting_team", label: "Attente équipe" },
  { id: "awaiting_result", label: "Attente résultat" },
  { id: "decided", label: "Décidées" },
  { id: "obsolete_flagged", label: "Obsolètes" },
  { id: "all", label: "Toutes" },
];

export default function DecisionsListClient({
  decisions,
  sources,
  upcomingConsultations,
}: Props) {
  const [filter, setFilter] = useState<Filter>("urgent");
  const [active, setActive] = useState<DecisionRow | null>(null);
  const router = useRouter();

  const counts = useMemo(() => {
    const c = {
      urgent: 0,
      pending: 0,
      awaiting_team: 0,
      awaiting_result: 0,
      obsolete_flagged: 0,
      decided: 0,
      all: decisions.length,
    } as Record<Filter, number>;
    for (const d of decisions) {
      if (d.status === "decided") c.decided++;
      else if (d.status === "obsolete") c.obsolete_flagged++;
      else if (d.status === "awaiting_team") c.awaiting_team++;
      else if (d.status === "awaiting_result") c.awaiting_result++;
      else if (d.status === "pending") {
        c.pending++;
        // urgent : pending sans obsolescence + (priority high ou échéance <14j)
        const hasObs = (d.obsolescence_signals ?? []).length > 0;
        const days = d.due_date
          ? Math.floor(
              (new Date(d.due_date).getTime() - Date.now()) / 86_400_000,
            )
          : null;
        const isUrgent =
          !hasObs && (d.priority === "high" || (days !== null && days <= 14));
        if (isUrgent) c.urgent++;
        if (hasObs) c.obsolete_flagged++;
      }
    }
    return c;
  }, [decisions]);

  const filtered = useMemo(() => {
    if (filter === "all") return decisions;
    if (filter === "decided") return decisions.filter((d) => d.status === "decided");
    if (filter === "awaiting_team")
      return decisions.filter((d) => d.status === "awaiting_team");
    if (filter === "awaiting_result")
      return decisions.filter((d) => d.status === "awaiting_result");
    if (filter === "obsolete_flagged")
      return decisions.filter(
        (d) =>
          d.status === "obsolete" ||
          (d.status === "pending" && (d.obsolescence_signals ?? []).length > 0),
      );
    if (filter === "urgent")
      return decisions.filter((d) => {
        if (d.status !== "pending") return false;
        if ((d.obsolescence_signals ?? []).length > 0) return false;
        const days = d.due_date
          ? Math.floor(
              (new Date(d.due_date).getTime() - Date.now()) / 86_400_000,
            )
          : null;
        return d.priority === "high" || (days !== null && days <= 14);
      });
    // pending
    return decisions.filter((d) => d.status === "pending");
  }, [decisions, filter]);

  async function batchArchiveObsoletes() {
    const candidates = decisions.filter(
      (d) =>
        d.status === "pending" && (d.obsolescence_signals ?? []).length > 0,
    );
    if (candidates.length === 0) return;
    if (
      !confirm(
        `Marquer ${candidates.length} décision(s) comme caduques ? Tu pourras les restaurer ensuite si besoin.`,
      )
    )
      return;
    const supabase = createClient();
    await supabase
      .from("decisions")
      .update({
        status: "obsolete",
        obsolescence_reason: "Archivage en masse depuis la détection automatique",
        obsolescence_detected_at: new Date().toISOString(),
      })
      .in(
        "id",
        candidates.map((d) => d.id),
      );
    router.refresh();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Décisions</h1>
        <p className="text-sm text-muted mt-1">
          Cockpit des choix soulevés par les documents et consultations.
        </p>
      </header>

      {/* Header synthèse : compteurs cliquables */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Urgentes"
          count={counts.urgent}
          tone="error"
          onClick={() => setFilter("urgent")}
          active={filter === "urgent"}
        />
        <SummaryCard
          icon={<Users className="w-4 h-4" />}
          label="Attente équipe"
          count={counts.awaiting_team}
          tone="info"
          onClick={() => setFilter("awaiting_team")}
          active={filter === "awaiting_team"}
        />
        <SummaryCard
          icon={<Telescope className="w-4 h-4" />}
          label="Attente résultat"
          count={counts.awaiting_result}
          tone="warning"
          onClick={() => setFilter("awaiting_result")}
          active={filter === "awaiting_result"}
        />
        <SummaryCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Obsolètes"
          count={counts.obsolete_flagged}
          tone="muted"
          onClick={() => setFilter("obsolete_flagged")}
          active={filter === "obsolete_flagged"}
          action={
            counts.obsolete_flagged > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  batchArchiveObsoletes();
                }}
                className="text-[10px] underline hover:text-ink"
              >
                Archiver tout
              </button>
            ) : null
          }
        />
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-hairline overflow-x-auto -mb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 transition-colors ${
              filter === t.id
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className="ml-1.5 text-[10px] text-muted">
                ({counts[t.id]})
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Liste : espace 6 sous les tabs */}
      <div className="pt-2">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-canvas-soft p-8 text-center">
            <GitBranch className="w-8 h-8 mx-auto text-muted-soft mb-2" />
            <p className="text-sm text-muted italic">
              {filter === "urgent"
                ? "Aucune décision urgente. Respire un peu."
                : filter === "obsolete_flagged"
                  ? "Aucune décision obsolète détectée."
                  : "Aucune décision dans cette catégorie."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((d) => (
              <DecisionRowCard
                key={d.id}
                decision={d}
                sources={sources}
                onActer={() => setActive(d)}
              />
            ))}
          </ul>
        )}
      </div>

      {active && (
        <DecideDecisionModal
          decision={active}
          upcomingConsultations={upcomingConsultations}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  count,
  tone,
  active,
  onClick,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "error" | "warning" | "info" | "muted";
  active: boolean;
  onClick: () => void;
  action?: React.ReactNode;
}) {
  const toneClass = {
    error: "border-error/30 bg-error/5 text-error",
    warning: "border-warning/30 bg-warning/5 text-warning",
    info: "border-blue-500/30 bg-blue-500/5 text-blue-600",
    muted: "border-hairline bg-canvas-soft text-muted",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors ${toneClass} ${
        active ? "ring-2 ring-ink/30" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[10px] uppercase tracking-wider">{label}</span>
        </div>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1">
        <span className="text-2xl font-semibold text-ink">{count}</span>
        {action}
      </div>
    </button>
  );
}

function DecisionRowCard({
  decision: d,
  sources,
  onActer,
}: {
  decision: DecisionRow;
  sources: SourceMap;
  onActer: () => void;
}) {
  const meta = getCategoryMeta(d.category);
  const Icon = meta.icon;
  const isPending = d.status === "pending";
  const isAwaitingTeam = d.status === "awaiting_team";
  const isAwaitingResult = d.status === "awaiting_result";
  const isDecided = d.status === "decided";
  const isObsolete = d.status === "obsolete";
  const hasObsFlag =
    isPending && (d.obsolescence_signals ?? []).length > 0;

  const sourceDoc = d.source_document_id
    ? sources.documents[d.source_document_id]
    : null;
  const sourceConsult = d.source_consultation_id
    ? sources.consultations[d.source_consultation_id]
    : null;

  const cardTone = isObsolete
    ? "border-hairline bg-canvas-soft opacity-70"
    : hasObsFlag
      ? "border-warning/40 bg-warning/5"
      : isAwaitingTeam
        ? "border-blue-500/30 bg-blue-500/5"
        : isAwaitingResult
          ? "border-yellow-500/30 bg-yellow-500/5"
          : isPending
            ? "border-hairline bg-surface-card"
            : isDecided
              ? "border-success/30 bg-success/5"
              : "border-hairline bg-canvas-soft";

  return (
    <li className={`rounded-lg border p-3 ${cardTone}`}>
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${meta.color}1a` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: meta.color,
                backgroundColor: `${meta.color}1a`,
                border: `1px solid ${meta.color}40`,
              }}
            >
              {meta.label}
            </span>
            <UrgencyBadge dueDate={d.due_date} />
            {d.priority === "high" && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/30">
                Prioritaire
              </span>
            )}
            {isAwaitingTeam && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/30">
                <Users className="w-3 h-3" /> Attente équipe
              </span>
            )}
            {isAwaitingResult && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/30">
                <Telescope className="w-3 h-3" /> Attente résultat
              </span>
            )}
            {isDecided && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30">
                <Check className="w-3 h-3" /> Décidée
              </span>
            )}
            {isObsolete && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-strong text-muted">
                Caduque
              </span>
            )}
            {hasObsFlag && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30">
                <AlertTriangle className="w-3 h-3" /> Possiblement caduque
              </span>
            )}
          </div>

          <h3 className="text-sm font-medium text-ink">{d.title}</h3>
          {d.question && (
            <p className="text-xs text-body mt-0.5">{d.question}</p>
          )}

          {isDecided && (
            <div className="mt-2 text-xs space-y-0.5">
              <p className="text-body-strong">
                <span className="text-muted">Choix :</span>{" "}
                {d.chosen_option ?? d.external_response_summary}
              </p>
              {d.rationale && (
                <p className="text-muted italic">« {d.rationale} »</p>
              )}
              {d.external_response_summary && !d.rationale && (
                <p className="text-muted italic">« {d.external_response_summary} »</p>
              )}
              <p className="text-muted">
                {d.decided_by && <span>par {d.decided_by} · </span>}
                {d.decided_at && <span>{formatDateFr(d.decided_at)}</span>}
              </p>
            </div>
          )}

          {isAwaitingTeam && d.team_note && (
            <p className="mt-1.5 text-xs text-muted italic">
              Note équipe : {d.team_note}
            </p>
          )}

          {isObsolete && d.obsolescence_reason && (
            <p className="mt-1.5 text-xs text-muted italic">
              Raison : {d.obsolescence_reason}
            </p>
          )}

          {(sourceDoc || sourceConsult) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
              {sourceDoc && (
                <Link
                  href={`/documents/${d.source_document_id}`}
                  className="inline-flex items-center gap-1 hover:text-ink"
                >
                  <FileText className="w-3 h-3" />
                  {sourceDoc.title}
                </Link>
              )}
              {sourceConsult && (
                <Link
                  href={`/consultation/${d.source_consultation_id}`}
                  className="inline-flex items-center gap-1 hover:text-ink"
                >
                  <Stethoscope className="w-3 h-3" />
                  Consult · {formatDateFr(sourceConsult.consultation_date)}
                </Link>
              )}
              {d.external_response_source && (
                <span className="inline-flex items-center gap-1">
                  <Mailbox className="w-3 h-3" />
                  {d.external_response_source}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            type="button"
            onClick={onActer}
            className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
              isPending || hasObsFlag
                ? "border-ink bg-ink text-canvas hover:bg-ink/90"
                : "border-hairline-strong text-body hover:text-ink"
            }`}
          >
            {isPending || hasObsFlag ? "Acter" : "Modifier"}
          </button>
        </div>
      </div>
    </li>
  );
}
