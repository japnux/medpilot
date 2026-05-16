"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, Plus, TrendingUp, CheckCircle2 } from "lucide-react";
import MedicationForm, {
  type CareTeamMember,
  type MedicationFormPrefill,
} from "./MedicationForm";
import DosageChangeModal from "./DosageChangeModal";
import type { Medication } from "@/lib/medications-helpers";
import { findMatchingMedication } from "@/lib/medication-match";

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
  const [creating, setCreating] = useState<MedicationFormPrefill | null>(null);
  // Modal changement de dose
  const [updatingDose, setUpdatingDose] = useState<{
    medication: Medication;
    newPosology: string;
    newDosage?: string;
  } | null>(null);

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
            return (
              <li key={idx} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
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
                    <p className="text-sm text-body">{p.posology}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      {p.indication && <span>💡 {p.indication}</span>}
                      {p.started_at && <span>Début : {p.started_at}</span>}
                      {p.ended_at && <span>Fin : {p.ended_at}</span>}
                    </div>

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

                  <div className="shrink-0 flex flex-col gap-1.5">
                    {match ? (
                      <button
                        type="button"
                        onClick={() =>
                          setUpdatingDose({
                            medication: match,
                            newPosology: p.posology,
                            newDosage: p.dosage ?? undefined,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-ink text-canvas hover:opacity-90 whitespace-nowrap"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Mettre à jour la dose
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setCreating(prescriptionToPrefill(p, documentDoctor))
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-ink text-canvas hover:opacity-90 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter aux médicaments
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
          defaultStatus={(creating.status ?? "active") as never}
          prefill={creating}
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
