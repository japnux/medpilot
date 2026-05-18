"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Loader2, Sparkles, X } from "lucide-react";
import type { ConsultationType } from "@/types/database";

interface Props {
  consultation: {
    id: string;
    family_id: string;
    consultation_date: string;
    consultation_type: string | null;
    doctor_name: string | null;
    hospital: string | null;
  };
  careTeamNames?: string[];
  onClose: () => void;
}

const CONSULT_TYPES: ConsultationType[] = [
  "oncologie",
  "endocrinologie",
  "chirurgie",
  "rcp",
  "genetique",
  "radiologie",
  "soins_support",
  "autre",
];

/**
 * Modal d'édition d'une consultation existante. Deux actions :
 *  - « Enregistrer » : sauve les champs (type, date, médecin, hôpital) seuls.
 *  - « Enregistrer et re-générer la prep » : sauve + appelle l'API
 *    prepare-consultation avec consultation_id pour rafraîchir
 *    prepared_questions avec le contexte complet à jour (KB + symptômes
 *    + décisions + veille + médocs + palier en cours).
 *
 * Pendant la regen, overlay freeze plein écran + spinner.
 */
export default function EditConsultationModal({
  consultation,
  careTeamNames = [],
  onClose,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<ConsultationType>(
    (CONSULT_TYPES as readonly string[]).includes(
      consultation.consultation_type ?? "",
    )
      ? (consultation.consultation_type as ConsultationType)
      : "autre",
  );
  const [date, setDate] = useState(consultation.consultation_date);
  const [doctor, setDoctor] = useState(consultation.doctor_name ?? "");
  const [hospital, setHospital] = useState(consultation.hospital ?? "");
  const [treatmentContext, setTreatmentContext] = useState("");
  const [openPoints, setOpenPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveFieldsOnly() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: e } = await supabase
        .from("consultations")
        .update({
          consultation_type: type,
          consultation_date: date,
          doctor_name: doctor.trim() || null,
          hospital: hospital.trim() || null,
        })
        .eq("id", consultation.id);
      if (e) throw e;

      // Met aussi à jour l'event timeline associé pour rester cohérent
      await supabase
        .from("timeline_events")
        .update({
          event_date: date,
          title: `Consultation ${type}${doctor ? ` · ${doctor}` : ""}`,
        })
        .eq("linked_consultation_id", consultation.id);

      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function saveAndRegen() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/prepare-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: consultation.family_id,
          consultation_id: consultation.id,
          consultation_type: type,
          consultation_date: date,
          doctor_name: doctor.trim() || undefined,
          hospital: hospital.trim() || undefined,
          treatment_context: treatmentContext.trim() || undefined,
          open_points: openPoints.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur de régénération");

      // L'event timeline associé peut nécessiter une mise à jour aussi
      const supabase = createClient();
      await supabase
        .from("timeline_events")
        .update({
          event_date: date,
          title: `Consultation ${type}${doctor ? ` · ${doctor}` : ""}`,
        })
        .eq("linked_consultation_id", consultation.id);

      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
        onClick={!regenerating ? onClose : undefined}
      >
        <div
          className="bg-canvas rounded-xl border border-hairline shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 p-5 border-b border-hairline">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">
                Modifier la consultation
              </p>
              <h3 className="text-base font-medium text-ink">
                {type} · {new Date(date).toLocaleDateString("fr-FR")}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={regenerating}
              className="shrink-0 w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-surface-card flex items-center justify-center disabled:opacity-50"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as ConsultationType)
                  }
                  className="w-full text-sm border border-hairline rounded-md px-3 py-2 bg-canvas"
                >
                  {CONSULT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm border border-hairline rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Médecin
              </label>
              <input
                type="text"
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                list="edit-consult-doctors"
                placeholder="Dr Grunenwald"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
              <datalist id="edit-consult-doctors">
                {careTeamNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Hôpital
              </label>
              <input
                type="text"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="CHU Toulouse"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
            </div>

            <div className="pt-2 border-t border-hairline space-y-3">
              <p className="text-xs text-muted">
                Champs utilisés uniquement pour la re-génération de la prep.
                Optionnels.
              </p>
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  Contexte traitement
                </label>
                <textarea
                  value={treatmentContext}
                  onChange={(e) => setTreatmentContext(e.target.value)}
                  rows={2}
                  placeholder="Ex : Sous mitotane depuis 2 sem, asthénie en hausse"
                  className="w-full text-sm border border-hairline rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  Points en suspens à aborder
                </label>
                <textarea
                  value={openPoints}
                  onChange={(e) => setOpenPoints(e.target.value)}
                  rows={2}
                  placeholder="Ex : Inclusion ADIUVO-2, statut MGMT, ajustement hydrocortisone"
                  className="w-full text-sm border border-hairline rounded-md px-3 py-2"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-error rounded-md border border-error/30 bg-error/5 p-2">
                {error}
              </p>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 p-4 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || regenerating}
              className="text-xs px-3 py-2 rounded-md border border-hairline-strong text-body hover:text-ink disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveFieldsOnly}
              disabled={saving || regenerating}
              className="text-xs px-3 py-2 rounded-md border border-hairline-strong text-body hover:text-ink disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={saveAndRegen}
              disabled={saving || regenerating}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-ink text-canvas hover:bg-ink/90 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Enregistrer & re-générer la prep
            </button>
          </footer>
        </div>
      </div>

      {regenerating && (
        <div
          className="fixed inset-0 z-[60] bg-canvas/85 backdrop-blur-sm flex items-center justify-center cursor-wait"
          role="alert"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-canvas border border-hairline shadow-lg px-6 py-5 max-w-xs text-center">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-ink">
                Re-génération en cours
              </p>
              <p className="text-xs text-muted mt-1">
                Claude reprend tout le contexte (symptômes, médocs, décisions,
                veille, KB) — 20 à 40 secondes.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
