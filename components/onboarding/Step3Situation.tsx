"use client";

import type { OnboardingState } from "@/app/onboarding/page";

const TREATMENTS = [
  "Chimiothérapie",
  "Radiothérapie",
  "Hormonothérapie",
  "Immunothérapie",
  "Thérapie ciblée",
  "Mitotane",
  "Surveillance simple",
  "Autre",
];

interface Props {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Step3Situation({ state, update, onBack, onNext }: Props) {
  function toggleTreatment(t: string) {
    const has = state.treatments.includes(t);
    update({
      treatments: has
        ? state.treatments.filter((x) => x !== t)
        : [...state.treatments, t],
    });
  }

  function addDoctor() {
    update({
      careTeam: [...state.careTeam, { name: "", specialty: "", hospital: "" }],
    });
  }
  function updateDoctor(i: number, patch: Partial<{ name: string; specialty: string; hospital: string }>) {
    const next = [...state.careTeam];
    next[i] = { ...next[i], ...patch };
    update({ careTeam: next });
  }
  function removeDoctor(i: number) {
    update({ careTeam: state.careTeam.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Situation actuelle</h2>
        <p className="text-sm text-muted mt-1">
          Ces informations contextualisent les analyses Claude.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm space-y-1">
          <span className="text-body">Date de diagnostic</span>
          <input
            type="date"
            value={state.diagnosisDate}
            onChange={(e) => update({ diagnosisDate: e.target.value })}
            className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-body">Stade / classification</span>
          <input
            value={state.stage}
            onChange={(e) => update({ stage: e.target.value })}
            placeholder="ex : ENSAT II"
            className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink"
          />
        </label>
      </div>

      <div className="rounded-lg border border-hairline p-4 space-y-3">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.hadSurgery}
            onChange={(e) => update({ hadSurgery: e.target.checked })}
            className="w-4 h-4 accent-primary"
          />
          <span className="text-body">Une chirurgie a déjà eu lieu</span>
        </label>
        {state.hadSurgery && (
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={state.surgeryDate}
              onChange={(e) => update({ surgeryDate: e.target.value })}
              className="h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink"
            />
            <select
              value={state.surgeryResult}
              onChange={(e) => update({ surgeryResult: e.target.value })}
              className="h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink"
            >
              <option value="R0">R0 — résection complète</option>
              <option value="R1">R1 — micro-résiduel</option>
              <option value="R2">R2 — macro-résiduel</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <span className="text-sm text-body block mb-2">Traitements en cours</span>
        <div className="flex flex-wrap gap-2">
          {TREATMENTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTreatment(t)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                state.treatments.includes(t)
                  ? "border-ink bg-surface-strong text-ink"
                  : "border-hairline-strong text-muted hover:border-hairline-strong"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-body">Équipe médicale</span>
          <button
            onClick={addDoctor}
            className="text-xs text-ink hover:text-ink"
          >
            + Ajouter un médecin
          </button>
        </div>
        {state.careTeam.map((d, i) => (
          <div key={i} className="grid grid-cols-7 gap-2 mb-2">
            <input
              placeholder="Nom"
              value={d.name}
              onChange={(e) => updateDoctor(i, { name: e.target.value })}
              className="col-span-2 h-9 px-2 rounded bg-surface-card border border-hairline-strong text-sm text-ink"
            />
            <input
              placeholder="Spécialité"
              value={d.specialty}
              onChange={(e) => updateDoctor(i, { specialty: e.target.value })}
              className="col-span-2 h-9 px-2 rounded bg-surface-card border border-hairline-strong text-sm text-ink"
            />
            <input
              placeholder="Hôpital"
              value={d.hospital}
              onChange={(e) => updateDoctor(i, { hospital: e.target.value })}
              className="col-span-2 h-9 px-2 rounded bg-surface-card border border-hairline-strong text-sm text-ink"
            />
            <button
              onClick={() => removeDoctor(i)}
              className="col-span-1 h-9 rounded border border-hairline-strong text-xs text-muted hover:text-error"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-lg border border-hairline-strong text-body hover:border-hairline-strong"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          className="h-11 px-5 rounded-lg bg-primary hover:bg-primary-active text-on-primary font-medium"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
