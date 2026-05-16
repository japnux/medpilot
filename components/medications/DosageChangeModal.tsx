"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Medication } from "@/lib/medications-helpers";

interface Props {
  medication: Medication;
  /** Care team déjà chargé pour proposer un datalist des prescripteurs. */
  careTeamNames?: string[];
  /** Nouvelle posologie pré-remplie (ex: depuis une ordonnance extraite). */
  prefillNewPosology?: string;
  /** Nouveau dosage pré-rempli. */
  prefillNewDosage?: string;
  /** Prescripteur pré-rempli. */
  prefillPrescriber?: string;
  onClose: () => void;
}

/**
 * Modal "Modifier la dose" — enregistre un change dans
 * medication_dosage_changes puis met à jour la row courante. Affiche
 * l'avant pour rappel et permet de documenter raison, prescripteur, date.
 */
export default function DosageChangeModal({
  medication: m,
  careTeamNames = [],
  prefillNewPosology,
  prefillNewDosage,
  prefillPrescriber,
  onClose,
}: Props) {
  const router = useRouter();
  const [newDosage, setNewDosage] = useState(prefillNewDosage ?? m.dosage ?? "");
  const [newPosology, setNewPosology] = useState(
    prefillNewPosology ?? m.posology ?? "",
  );
  const [changedAt, setChangedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState("");
  const [prescriber, setPrescriber] = useState(prefillPrescriber ?? m.prescriber ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!newDosage.trim()) {
      setError("Renseigne la nouvelle dose.");
      return;
    }
    if (newDosage.trim() === (m.dosage ?? "").trim() && newPosology.trim() === m.posology.trim()) {
      setError("Aucun changement détecté par rapport à la dose actuelle.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/medications/${m.id}/dosage-change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_dosage: newDosage.trim(),
            new_posology: newPosology.trim() || null,
            changed_at: changedAt,
            reason: reason.trim() || null,
            prescriber: prescriber.trim() || null,
            notes: notes.trim() || null,
          }),
        },
      );
      const j = await res.json();
      if (!res.ok && res.status !== 207) {
        throw new Error(j.error ?? "Erreur");
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

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
              Modifier la dose
            </p>
            <h3 className="text-base font-medium text-ink truncate">
              {m.name}
              {m.brand_name ? (
                <span className="text-muted"> ({m.brand_name})</span>
              ) : null}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Dose actuelle :{" "}
              <span className="text-body-strong">{m.dosage ?? "non précisée"}</span>
              {m.posology ? ` — ${m.posology}` : ""}
            </p>
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

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Nouvelle dose <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={newDosage}
                onChange={(e) => setNewDosage(e.target.value)}
                placeholder="Ex : 20 mg"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Date du changement
              </label>
              <input
                type="date"
                value={changedAt}
                onChange={(e) => setChangedAt(e.target.value)}
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Nouvelle posologie
            </label>
            <textarea
              value={newPosology}
              onChange={(e) => setNewPosology(e.target.value)}
              rows={2}
              placeholder="Ex : 10 mg matin + 5 mg midi + 5 mg fin d'après-midi"
              className="w-full text-sm border border-hairline rounded-md px-3 py-2"
            />
            <p className="text-[11px] text-muted mt-1">
              Si laissée vide, la posologie courante est conservée.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Raison clinique
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : Asthénie de fin de journée, ajustement post-RCP"
              className="w-full text-sm border border-hairline rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Prescripteur
            </label>
            <input
              type="text"
              value={prescriber}
              onChange={(e) => setPrescriber(e.target.value)}
              placeholder="Nom du médecin"
              list="dosage-prescribers"
              className="w-full text-sm border border-hairline rounded-md px-3 py-2"
            />
            <datalist id="dosage-prescribers">
              {careTeamNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-medium text-ink block mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Précisions optionnelles"
              className="w-full text-sm border border-hairline rounded-md px-3 py-2"
            />
          </div>

          {error && (
            <p className="text-xs text-error rounded-md border border-error/30 bg-error/5 p-2">
              {error}
            </p>
          )}

          <p className="text-[11px] text-muted">
            L&apos;ancienne dose <span className="text-body-strong">{m.dosage ?? "non précisée"}</span>{" "}
            sera archivée dans l&apos;historique et un événement sera ajouté à la timeline.
          </p>
        </div>

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
            onClick={submit}
            disabled={saving}
            className="text-xs px-3 py-2 rounded-md bg-ink text-canvas hover:bg-ink/90 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer le changement"}
          </button>
        </footer>
      </div>
    </div>
  );
}
