"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { DECIDED_BY_OPTIONS, type DecisionRow } from "@/lib/decisions";
import {
  AlertTriangle,
  Check,
  CircleSlash,
  Mailbox,
  Stethoscope,
  X,
} from "lucide-react";
import RecommendationSourceTag from "./RecommendationSource";

type Path = "decided" | "awaiting_team" | "external_response" | "obsolete";

interface UpcomingConsultation {
  id: string;
  consultation_date: string;
  consultation_type: string | null;
  doctor_name: string | null;
}

interface Props {
  decision: DecisionRow;
  upcomingConsultations?: UpcomingConsultation[];
  onClose: () => void;
}

/**
 * Modal d'actage d'une décision avec 4 chemins :
 *  - Décidée : choix d'option + rationale (workflow original)
 *  - À poser à l'équipe : lien vers une consultation upcoming + note
 *  - Réponse reçue : l'équipe a tranché sans choix patient (résumé + source)
 *  - Caduque : raison d'obsolescence
 *
 * Une bannière d'obsolescence apparait en haut si des signaux sont détectés.
 * Le chemin "Caduque" est pré-sélectionné dans ce cas.
 */
export default function DecideDecisionModal({
  decision,
  upcomingConsultations = [],
  onClose,
}: Props) {
  const router = useRouter();
  const hasObsolescence =
    (decision.obsolescence_signals ?? []).length > 0;

  const [path, setPath] = useState<Path>(
    hasObsolescence ? "obsolete" : "decided",
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-canvas rounded-xl border border-hairline shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-hairline">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted">
              Acter la décision
            </p>
            <h3 className="text-base font-medium text-ink truncate">
              {decision.title}
            </h3>
            {decision.question && (
              <p className="text-xs text-body mt-0.5">{decision.question}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-surface-card flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {hasObsolescence && (
          <ObsolescenceBanner decision={decision} />
        )}

        {/* Sélecteur de chemin */}
        <div className="px-5 pt-4">
          <p className="text-xs font-medium text-ink mb-2">
            Que souhaitez-vous faire ?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <PathButton
              active={path === "decided"}
              onClick={() => setPath("decided")}
              icon={<Check className="w-3.5 h-3.5" />}
              label="Décidée"
            />
            <PathButton
              active={path === "awaiting_team"}
              onClick={() => setPath("awaiting_team")}
              icon={<Stethoscope className="w-3.5 h-3.5" />}
              label="Équipe"
            />
            <PathButton
              active={path === "external_response"}
              onClick={() => setPath("external_response")}
              icon={<Mailbox className="w-3.5 h-3.5" />}
              label="Réponse"
            />
            <PathButton
              active={path === "obsolete"}
              onClick={() => setPath("obsolete")}
              icon={<CircleSlash className="w-3.5 h-3.5" />}
              label="Caduque"
            />
          </div>
        </div>

        {path === "decided" && (
          <DecidedPathForm
            decision={decision}
            router={router}
            onClose={onClose}
          />
        )}
        {path === "awaiting_team" && (
          <AwaitingTeamPathForm
            decision={decision}
            upcomingConsultations={upcomingConsultations}
            router={router}
            onClose={onClose}
          />
        )}
        {path === "external_response" && (
          <ExternalResponsePathForm
            decision={decision}
            upcomingConsultations={upcomingConsultations}
            router={router}
            onClose={onClose}
          />
        )}
        {path === "obsolete" && (
          <ObsoletePathForm
            decision={decision}
            router={router}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function PathButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-md text-xs border transition-colors ${
        active
          ? "border-ink bg-ink text-canvas"
          : "border-hairline text-body hover:bg-surface-card"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ObsolescenceBanner({ decision }: { decision: DecisionRow }) {
  const signals = decision.obsolescence_signals ?? [];
  return (
    <div className="mx-5 mt-4 rounded-md border border-warning/40 bg-warning/5 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-warning">
            Cette décision est probablement obsolète
          </p>
          <ul className="mt-1 space-y-0.5 text-body">
            {signals.map((s, i) => (
              <li key={i}>• {s.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------- Chemin 1 : Décidée ----------
function DecidedPathForm({
  decision,
  router,
  onClose,
}: {
  decision: DecisionRow;
  router: ReturnType<typeof useRouter>;
  onClose: () => void;
}) {
  const [chosenOption, setChosenOption] = useState(decision.chosen_option ?? "");
  const [customOption, setCustomOption] = useState("");
  const [rationale, setRationale] = useState(decision.rationale ?? "");
  const [decidedBy, setDecidedBy] = useState(decision.decided_by ?? "patient");
  const [decidedAt, setDecidedAt] = useState(
    decision.decided_at ?? new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useCustom = chosenOption === "__custom__";
  const finalChoice = useCustom ? customOption.trim() : chosenOption;

  async function submit() {
    if (!finalChoice) {
      setError("Indique l'option choisie.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: upErr } = await supabase
        .from("decisions")
        .update({
          status: "decided",
          chosen_option: finalChoice,
          rationale: rationale.trim() || null,
          decided_by: decidedBy,
          decided_at: decidedAt,
        })
        .eq("id", decision.id);
      if (upErr) throw upErr;

      await supabase.from("timeline_events").insert({
        family_id: decision.family_id,
        event_type: "decision",
        event_date: decidedAt,
        title: `Décision : ${decision.title}`,
        summary: `${finalChoice}${rationale ? ` — ${rationale}` : ""}`,
        is_critical: decision.priority === "high",
        linked_document_id: decision.source_document_id,
        linked_consultation_id: decision.source_consultation_id,
      });

      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Option choisie
          </label>
          <div className="space-y-1.5">
            {decision.options.map((o, i) => (
              <label
                key={i}
                className={`flex items-start gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  chosenOption === o.label
                    ? "border-ink bg-surface-card"
                    : "border-hairline hover:bg-surface-card"
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  value={o.label}
                  checked={chosenOption === o.label}
                  onChange={() => setChosenOption(o.label)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {o.label}
                    {o.recommended && (
                      <span className="ml-1.5 text-[10px] text-success">
                        ✓ recommandée
                      </span>
                    )}
                  </p>
                  {(o.pros?.length || o.cons?.length) && (
                    <div className="mt-1 text-[11px] space-y-0.5">
                      {o.pros?.map((p, j) => (
                        <p key={`p${j}`} className="text-success">
                          + {p}
                        </p>
                      ))}
                      {o.cons?.map((c, j) => (
                        <p key={`c${j}`} className="text-warning">
                          − {c}
                        </p>
                      ))}
                    </div>
                  )}
                  {o.recommended && (
                    <RecommendationSourceTag source={decision.recommendation_source} />
                  )}
                </div>
              </label>
            ))}
            <label
              className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                useCustom
                  ? "border-ink bg-surface-card"
                  : "border-hairline hover:bg-surface-card"
              }`}
            >
              <input
                type="radio"
                name="option"
                value="__custom__"
                checked={useCustom}
                onChange={() => setChosenOption("__custom__")}
              />
              <span className="text-sm text-body">Autre choix (libre)</span>
            </label>
            {useCustom && (
              <input
                type="text"
                value={customOption}
                onChange={(e) => setCustomOption(e.target.value)}
                placeholder="Décris le choix retenu"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2 mt-1"
              />
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Pourquoi ce choix (rationale)
          </label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            placeholder="Ex : Régis a accepté après explication, profil haut risque."
            className="w-full text-sm border border-hairline rounded-md px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Décidé par
            </label>
            <select
              value={decidedBy}
              onChange={(e) => setDecidedBy(e.target.value)}
              className="w-full text-sm border border-hairline rounded-md px-3 py-2 bg-canvas"
            >
              {DECIDED_BY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={decidedAt}
              onChange={(e) => setDecidedAt(e.target.value)}
              className="w-full text-sm border border-hairline rounded-md px-3 py-2"
            />
          </div>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      <Footer
        onClose={onClose}
        onSubmit={submit}
        saving={saving}
        submitLabel="Enregistrer la décision"
      />
    </>
  );
}

// ---------- Chemin 2 : À poser à l'équipe ----------
function AwaitingTeamPathForm({
  decision,
  upcomingConsultations,
  router,
  onClose,
}: {
  decision: DecisionRow;
  upcomingConsultations: UpcomingConsultation[];
  router: ReturnType<typeof useRouter>;
  onClose: () => void;
}) {
  const [consultId, setConsultId] = useState<string>(
    decision.source_consultation_id ?? upcomingConsultations[0]?.id ?? "",
  );
  const [note, setNote] = useState(decision.team_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: upErr } = await supabase
        .from("decisions")
        .update({
          status: "awaiting_team",
          source_consultation_id: consultId || null,
          team_note: note.trim() || null,
        })
        .eq("id", decision.id);
      if (upErr) throw upErr;
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted">
          La décision sera mise en attente d&apos;avis de l&apos;équipe. Elle
          apparaîtra automatiquement dans la prochaine prep consultation liée.
        </p>

        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Consultation cible
          </label>
          {upcomingConsultations.length === 0 ? (
            <p className="text-xs text-muted italic">
              Aucune consultation à venir — la décision restera en attente sans
              consultation rattachée.
            </p>
          ) : (
            <div className="space-y-1.5">
              {upcomingConsultations.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                    consultId === c.id
                      ? "border-ink bg-surface-card"
                      : "border-hairline hover:bg-surface-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="consult"
                    value={c.id}
                    checked={consultId === c.id}
                    onChange={() => setConsultId(c.id)}
                  />
                  <span className="text-sm text-ink">
                    {new Date(c.consultation_date).toLocaleDateString("fr-FR")}
                    {c.consultation_type ? ` · ${c.consultation_type}` : ""}
                    {c.doctor_name ? ` · ${c.doctor_name}` : ""}
                  </span>
                </label>
              ))}
              <label
                className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  consultId === ""
                    ? "border-ink bg-surface-card"
                    : "border-hairline hover:bg-surface-card"
                }`}
              >
                <input
                  type="radio"
                  name="consult"
                  value=""
                  checked={consultId === ""}
                  onChange={() => setConsultId("")}
                />
                <span className="text-sm text-body">
                  Pas encore programmée
                </span>
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Note pour la consultation (optionnel)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex : Demander spécifiquement le statut MGMT et son impact sur l'indication adjuvante."
            className="w-full text-sm border border-hairline rounded-md px-3 py-2"
          />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}
      </div>
      <Footer
        onClose={onClose}
        onSubmit={submit}
        saving={saving}
        submitLabel="Mettre en attente équipe"
      />
    </>
  );
}

// ---------- Chemin 3 : Réponse reçue ----------
function ExternalResponsePathForm({
  decision,
  upcomingConsultations,
  router,
  onClose,
}: {
  decision: DecisionRow;
  upcomingConsultations: UpcomingConsultation[];
  router: ReturnType<typeof useRouter>;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState(decision.external_response_summary ?? "");
  const [sourceType, setSourceType] = useState<"consultation" | "courrier" | "telephone" | "autre">(
    "consultation",
  );
  const [consultId, setConsultId] = useState<string>(
    decision.source_consultation_id ?? upcomingConsultations[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    decision.external_response_date ?? new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!summary.trim()) {
      setError("Résume la réponse reçue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const sourceLabel =
        sourceType === "consultation" && consultId
          ? `Consultation ${upcomingConsultations.find((c) => c.id === consultId)?.consultation_type ?? ""}`
          : sourceType;

      const { error: upErr } = await supabase
        .from("decisions")
        .update({
          status: "decided",
          external_response_summary: summary.trim(),
          external_response_source: sourceLabel,
          external_response_date: date,
          source_consultation_id:
            sourceType === "consultation" ? consultId || null : decision.source_consultation_id,
          decided_at: date,
          decided_by: "équipe médicale",
        })
        .eq("id", decision.id);
      if (upErr) throw upErr;

      await supabase.from("timeline_events").insert({
        family_id: decision.family_id,
        event_type: "decision",
        event_date: date,
        title: `Décision (équipe) : ${decision.title}`,
        summary: summary.trim(),
        is_critical: decision.priority === "high",
        linked_document_id: decision.source_document_id,
        linked_consultation_id:
          sourceType === "consultation" ? consultId || null : decision.source_consultation_id,
      });

      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="p-5 space-y-4">
        <p className="text-xs text-muted">
          L&apos;équipe médicale a tranché sans qu&apos;un choix patient soit
          formellement posé : consigne le résumé pour traçabilité.
        </p>

        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Résumé de la réponse
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Ex : Dr Grunenwald a décliné l'inclusion COMETE-CARE car Régis ne remplit pas le critère d'âge."
            className="w-full text-sm border border-hairline rounded-md px-3 py-2"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Source de la réponse
          </label>
          <div className="space-y-1.5">
            {(
              [
                { v: "consultation", l: "Consultation" },
                { v: "courrier", l: "Email / courrier" },
                { v: "telephone", l: "Téléphone" },
                { v: "autre", l: "Autre" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.v}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${
                  sourceType === opt.v
                    ? "border-ink bg-surface-card"
                    : "border-hairline hover:bg-surface-card"
                }`}
              >
                <input
                  type="radio"
                  name="src"
                  checked={sourceType === opt.v}
                  onChange={() => setSourceType(opt.v)}
                />
                <span className="text-sm text-ink">{opt.l}</span>
              </label>
            ))}
          </div>
          {sourceType === "consultation" && upcomingConsultations.length > 0 && (
            <select
              value={consultId}
              onChange={(e) => setConsultId(e.target.value)}
              className="mt-2 w-full text-sm border border-hairline rounded-md px-3 py-2 bg-canvas"
            >
              {upcomingConsultations.map((c) => (
                <option key={c.id} value={c.id}>
                  {new Date(c.consultation_date).toLocaleDateString("fr-FR")}
                  {c.doctor_name ? ` · ${c.doctor_name}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Date de la réponse
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-sm border border-hairline rounded-md px-3 py-2"
          />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}
      </div>
      <Footer
        onClose={onClose}
        onSubmit={submit}
        saving={saving}
        submitLabel="Enregistrer la réponse"
      />
    </>
  );
}

// ---------- Chemin 4 : Caduque ----------
function ObsoletePathForm({
  decision,
  router,
  onClose,
}: {
  decision: DecisionRow;
  router: ReturnType<typeof useRouter>;
  onClose: () => void;
}) {
  const [reasonKey, setReasonKey] = useState<
    "events_passed" | "context_changed" | "replaced" | "other"
  >(decision.obsolescence_signals?.length ? "events_passed" : "context_changed");
  const [precisions, setPrecisions] = useState(decision.obsolescence_reason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const labels: Record<typeof reasonKey, string> = {
        events_passed: "Dépassée par les événements",
        context_changed: "Le contexte clinique a changé",
        replaced: "Remplacée par une autre décision",
        other: "Autre raison",
      };
      const reason = precisions.trim()
        ? `${labels[reasonKey]} — ${precisions.trim()}`
        : labels[reasonKey];

      const supabase = createClient();
      const { error: upErr } = await supabase
        .from("decisions")
        .update({
          status: "obsolete",
          obsolescence_reason: reason,
          obsolescence_detected_at: new Date().toISOString(),
        })
        .eq("id", decision.id);
      if (upErr) throw upErr;
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Pourquoi cette décision n&apos;est plus pertinente ?
          </label>
          <div className="space-y-1.5">
            {(
              [
                { v: "events_passed", l: "Dépassée par les événements" },
                { v: "context_changed", l: "Le contexte clinique a changé" },
                { v: "replaced", l: "Remplacée par une autre décision" },
                { v: "other", l: "Autre raison" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.v}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${
                  reasonKey === opt.v
                    ? "border-ink bg-surface-card"
                    : "border-hairline hover:bg-surface-card"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  checked={reasonKey === opt.v}
                  onChange={() => setReasonKey(opt.v)}
                />
                <span className="text-sm text-ink">{opt.l}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-ink block mb-1.5">
            Précisions (optionnel)
          </label>
          <textarea
            value={precisions}
            onChange={(e) => setPrecisions(e.target.value)}
            rows={2}
            placeholder="Ex : La chirurgie a été faite le 20/04, ce bilan pré-op n'a plus de raison d'être."
            className="w-full text-sm border border-hairline rounded-md px-3 py-2"
          />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}
      </div>
      <Footer
        onClose={onClose}
        onSubmit={submit}
        saving={saving}
        submitLabel="Marquer comme caduque"
      />
    </>
  );
}

function Footer({
  onClose,
  onSubmit,
  saving,
  submitLabel,
}: {
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <footer className="flex items-center justify-end gap-2 p-4 border-t border-hairline">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="text-xs px-3 py-2 rounded-md border border-hairline-strong text-body hover:text-ink"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className="text-xs px-3 py-2 rounded-md bg-ink text-canvas hover:bg-ink/90 disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : submitLabel}
      </button>
    </footer>
  );
}
