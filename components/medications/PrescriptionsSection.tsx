"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pill,
  Plus,
  TrendingUp,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import MedicationForm, {
  type CareTeamMember,
  type MedicationFormPrefill,
} from "./MedicationForm";
import DosageChangeModal from "./DosageChangeModal";
import type { Medication } from "@/lib/medications-helpers";
import { findMatchingMedication } from "@/lib/medication-match";
import { formatDateShort } from "@/lib/dates";

/** Un palier de schéma posologique extrait de l'ordonnance. */
export interface ExtractedScheduleStep {
  step_order: number;
  start_date: string;
  end_date: string | null;
  dosage: string | null;
  posology: string;
  notes?: string | null;
}

/**
 * Une prescription extraite d'une ordonnance via Claude.
 * Format produit par DOCUMENT_ANALYSIS_PROMPT.
 */
export interface ExtractedPrescription {
  name: string;
  brand_name?: string | null;
  active_ingredient?: string | null;
  dosage?: string | null;
  form?: string | null;
  posology: string;
  route?: string | null;
  indication?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status?: string | null;
  schedule?: ExtractedScheduleStep[];
}

interface Props {
  prescriptions: ExtractedPrescription[];
  /** Médicaments existants de la famille (pour la détection de match). */
  existingMedications: Medication[];
  /** Care team du patient (pour le datalist des prescripteurs). */
  careTeam: CareTeamMember[];
  /** Nom du médecin signataire du document, utilisé comme prescripteur par défaut. */
  documentDoctor?: string | null;
}

/**
 * Section affichée sur la page document quand le doc est une ordonnance
 * (ou contient des prescriptions explicites). Pour chaque ligne :
 *  - si match avec un médicament existant → bouton "Mettre à jour la dose"
 *  - sinon → bouton "Ajouter aux médicaments"
 * Aucune écriture automatique : l'utilisateur valide chaque ligne manuellement.
 */
export default function PrescriptionsSection({
  prescriptions,
  existingMedications,
  careTeam,
  documentDoctor,
}: Props) {
  const router = useRouter();

  // Modal édition / création (mode pré-rempli)
  const [creating, setCreating] = useState<{
    prefill: MedicationFormPrefill;
    schedule: ExtractedScheduleStep[];
  } | null>(null);
  // Modal changement de dose (pour les prescriptions SANS schedule structuré)
  const [updatingDose, setUpdatingDose] = useState<{
    medication: Medication;
    newPosology: string;
    newDosage?: string;
  } | null>(null);
  // Replacement de plan posologique (pour les prescriptions AVEC schedule)
  const [replacingPlan, setReplacingPlan] = useState<{
    medicationId: string;
    medicationName: string;
    steps: ExtractedScheduleStep[];
    posology: string;
    dosage: string | null;
  } | null>(null);
  // État busy par row pour le bouton "Remplacer le plan"
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  // Schedule replié / déplié par prescription
  const [openSchedule, setOpenSchedule] = useState<Set<number>>(new Set());

  /**
   * Remplace le plan posologique d'un médicament existant par celui extrait
   * de l'ordonnance. Met aussi à jour dosage/posology de la fiche pour
   * refléter le palier en cours (calculé côté UI via getCurrentStep).
   */
  async function replacePlan() {
    if (!replacingPlan) return;
    setPlanBusy(true);
    setPlanError(null);
    try {
      // 1. PUT du schedule complet
      const stepsPayload = replacingPlan.steps.map((s) => ({
        step_order: s.step_order,
        start_date: s.start_date,
        end_date: s.end_date,
        dosage: s.dosage,
        posology: s.posology,
        notes: s.notes ?? null,
      }));
      const resSched = await fetch(
        `/api/medications/${replacingPlan.medicationId}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steps: stepsPayload }),
        },
      );
      if (!resSched.ok) {
        const j = await resSched.json().catch(() => ({}));
        throw new Error(j?.error ?? "Erreur PUT /schedule");
      }
      // 2. Update la fiche médicament avec la posologie/dosage "globale" comme
      // backup (au cas où on est hors période de schedule, ou pour l'IA qui
      // lit posology). On y met le texte complet de la prescription.
      const resMed = await fetch(
        `/api/medications/${replacingPlan.medicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posology: replacingPlan.posology,
            dosage: replacingPlan.dosage,
          }),
        },
      );
      if (!resMed.ok) {
        const j = await resMed.json().catch(() => ({}));
        throw new Error(j?.error ?? "Erreur PATCH /medications");
      }
      setReplacingPlan(null);
      router.refresh();
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanBusy(false);
    }
  }

  function toggleSchedule(idx: number) {
    setOpenSchedule((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (!prescriptions || prescriptions.length === 0) return null;

  const careTeamNames = careTeam
    .map((c) => c.name)
    .filter((n): n is string => Boolean(n));

  return (
    <>
      <section className="rounded-xl border border-hairline bg-canvas-soft overflow-hidden">
        <header className="px-5 py-4 border-b border-hairline flex items-center gap-2">
          <Pill className="w-4 h-4 text-fuchsia-600" />
          <h2 className="text-base font-medium text-ink">
            Prescriptions extraites
          </h2>
          <span className="text-xs text-muted">
            ({prescriptions.length})
          </span>
        </header>

        <ul className="divide-y divide-hairline">
          {prescriptions.map((p, idx) => {
            const match = findMatchingMedication(p, existingMedications);
            const matchActive = match && match.status === "active";
            const hasSchedule = Array.isArray(p.schedule) && p.schedule.length > 0;
            const isScheduleOpen = openSchedule.has(idx);
            return (
              <li key={idx} className="px-4 sm:px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-ink">
                        {p.name}
                      </h3>
                      {p.brand_name && (
                        <span className="text-xs text-muted">
                          ({p.brand_name})
                        </span>
                      )}
                      {p.dosage && (
                        <span className="text-xs text-body">· {p.dosage}</span>
                      )}
                    </div>
                    <p className="text-sm text-body whitespace-pre-wrap break-words">
                      {p.posology}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      {p.indication && <span>💡 {p.indication}</span>}
                      {p.started_at && (
                        <span>Début : {formatDateShort(p.started_at)}</span>
                      )}
                      {p.ended_at && (
                        <span>Fin : {formatDateShort(p.ended_at)}</span>
                      )}
                    </div>

                    {hasSchedule && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => toggleSchedule(idx)}
                          className="flex items-center gap-1.5 text-xs text-fuchsia-700 hover:text-fuchsia-900 font-medium text-left"
                        >
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Plan posologique en {p.schedule!.length} paliers
                          </span>
                          {isScheduleOpen ? (
                            <ChevronUp className="w-3 h-3 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3 h-3 shrink-0" />
                          )}
                        </button>
                        {isScheduleOpen && (
                          <ol className="mt-2 space-y-1.5 border-l-2 border-fuchsia-200 pl-3">
                            {p.schedule!.map((step) => (
                              <li
                                key={step.step_order}
                                className="text-xs text-body"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-100 text-fuchsia-700 text-[10px] font-medium">
                                    {step.step_order}
                                  </span>
                                  <span className="font-medium text-ink">
                                    {step.dosage ?? step.posology}
                                  </span>
                                  <span className="text-muted">
                                    · {formatDateShort(step.start_date)}
                                    {step.end_date
                                      ? ` → ${formatDateShort(step.end_date)}`
                                      : " (maintenance)"}
                                  </span>
                                </span>
                                {step.dosage && (
                                  <p className="mt-0.5 ml-7 text-muted">
                                    {step.posology}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}

                    {match && (
                      <p className="text-xs text-emerald-700 flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Déjà saisi sous «&nbsp;{match.name}
                        {match.brand_name ? ` (${match.brand_name})` : ""}
                        &nbsp;»
                        {matchActive ? " — actif" : ` — ${match.status}`}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col gap-1.5 sm:items-end w-full sm:w-auto">
                    {match ? (
                      hasSchedule ? (
                        <button
                          type="button"
                          onClick={() =>
                            setReplacingPlan({
                              medicationId: match.id,
                              medicationName: match.name,
                              steps: p.schedule!,
                              posology: p.posology,
                              dosage: p.dosage ?? null,
                            })
                          }
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-fuchsia-600 text-white hover:opacity-90"
                        >
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Remplacer le plan ({p.schedule!.length} paliers)
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setUpdatingDose({
                              medication: match,
                              newPosology: p.posology,
                              newDosage: p.dosage ?? undefined,
                            })
                          }
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-ink text-canvas hover:opacity-90"
                        >
                          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                          Mettre à jour la dose
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setCreating({
                            prefill: prescriptionToPrefill(p, documentDoctor),
                            schedule: p.schedule ?? [],
                          })
                        }
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-ink text-canvas hover:opacity-90"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {hasSchedule
                            ? `Ajouter (${p.schedule!.length} paliers)`
                            : "Ajouter aux médicaments"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="px-5 py-3 border-t border-hairline bg-canvas">
          <p className="text-xs text-muted">
            Chaque prescription est validée manuellement — rien n&apos;est
            créé sans votre clic.
          </p>
        </footer>
      </section>

      {creating && (
        <MedicationForm
          existing={existingMedications}
          careTeam={careTeam}
          defaultStatus={(creating.prefill.status ?? "active") as never}
          prefill={creating.prefill}
          prefillSchedule={creating.schedule}
          onClose={() => setCreating(null)}
          onSaved={() => {
            setCreating(null);
            router.refresh();
          }}
        />
      )}

      {updatingDose && (
        <DosageChangeModal
          medication={updatingDose.medication}
          careTeamNames={careTeamNames}
          prefillNewPosology={updatingDose.newPosology}
          prefillNewDosage={updatingDose.newDosage}
          prefillPrescriber={documentDoctor ?? undefined}
          onClose={() => {
            setUpdatingDose(null);
            router.refresh();
          }}
        />
      )}

      {/* Modal confirmation remplacement de plan posologique */}
      {replacingPlan && (
        <>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => !planBusy && setReplacingPlan(null)}
            className="fixed inset-0 z-40 bg-ink/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-canvas rounded-xl shadow-2xl border border-hairline"
          >
            <header className="px-5 py-4 border-b border-hairline">
              <h3 className="text-base font-medium text-ink">
                Remplacer le plan posologique
              </h3>
              <p className="text-xs text-muted mt-1">
                {replacingPlan.medicationName}
              </p>
            </header>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-body">
                Cette action va remplacer{" "}
                <strong>l&apos;intégralité du plan posologique</strong> existant
                par les <strong>{replacingPlan.steps.length} paliers</strong>{" "}
                extraits de cette ordonnance.
              </p>
              <ol className="space-y-1 text-xs">
                {replacingPlan.steps.map((s) => (
                  <li
                    key={s.step_order}
                    className="flex gap-2 items-baseline"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-100 text-fuchsia-700 text-[10px] font-medium shrink-0">
                      {s.step_order}
                    </span>
                    <span className="text-ink font-medium">
                      {s.dosage ?? s.posology}
                    </span>
                    <span className="text-muted">
                      {s.start_date}
                      {s.end_date ? ` → ${s.end_date}` : " (maintenance)"}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                ⚠️ Si un plan existait déjà sur ce médicament, il sera supprimé.
                L&apos;historique des changements de dose ponctuels reste intact.
              </p>
              {planError && (
                <p className="text-xs text-red-600">{planError}</p>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-hairline flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplacingPlan(null)}
                disabled={planBusy}
                className="px-3 py-1.5 text-sm rounded-md text-muted hover:text-ink"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={replacePlan}
                disabled={planBusy}
                className="px-3 py-1.5 text-sm rounded-md bg-fuchsia-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {planBusy ? "Mise à jour…" : "Confirmer le remplacement"}
              </button>
            </footer>
          </div>
        </>
      )}
    </>
  );
}

/** Convertit une prescription extraite en pré-remplissage du form. */
function prescriptionToPrefill(
  p: ExtractedPrescription,
  doctor: string | null | undefined,
): MedicationFormPrefill {
  const validStatus = ["active", "stopped", "paused", "planned"];
  return {
    name: p.name,
    brand_name: p.brand_name ?? "",
    active_ingredient: p.active_ingredient ?? "",
    dosage: p.dosage ?? "",
    form: p.form ?? "",
    posology: p.posology,
    route: validRoute(p.route),
    indication: p.indication ?? "",
    prescriber: doctor ?? "",
    started_at: p.started_at ?? "",
    ended_at: p.ended_at ?? "",
    status: validStatus.includes(p.status ?? "")
      ? (p.status as "active" | "stopped" | "paused" | "planned")
      : "active",
  };
}

function validRoute(
  r: string | null | undefined,
):
  | "oral"
  | "im"
  | "iv"
  | "sc"
  | "topical"
  | "inhaled"
  | "sublingual"
  | "other" {
  const ALLOWED = [
    "oral",
    "im",
    "iv",
    "sc",
    "topical",
    "inhaled",
    "sublingual",
    "other",
  ] as const;
  return (ALLOWED as readonly string[]).includes(r ?? "")
    ? (r as (typeof ALLOWED)[number])
    : "oral";
}
