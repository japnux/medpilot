"use client";

import type { OnboardingState } from "@/app/onboarding/page";
import { CANCER_PROFILE_OPTIONS } from "@/lib/cancer-profiles";

interface Props {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Step2Patient({ state, update, onBack, onNext }: Props) {
  const isCustom = state.cancerType === "custom";
  const canNext =
    state.patientFirstName.trim().length > 0 &&
    (state.cancerType !== "custom" || state.customCancerLabel.trim().length > 0);

  function addMarker() {
    update({
      customMarkers: [...state.customMarkers, { key: "", label: "", unit: "" }],
    });
  }
  function updateMarker(i: number, patch: Partial<{ key: string; label: string; unit: string }>) {
    const next = [...state.customMarkers];
    next[i] = { ...next[i], ...patch };
    update({ customMarkers: next });
  }
  function removeMarker(i: number) {
    update({ customMarkers: state.customMarkers.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-ink">Profil du patient</h2>
        <p className="text-sm text-muted mt-1">
          Informations de base et type de cancer.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm space-y-1">
          <span className="text-body">Prénom du patient</span>
          <input
            value={state.patientFirstName}
            onChange={(e) => update({ patientFirstName: e.target.value })}
            className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink focus:border-ink focus:outline-none"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-body">Date de naissance</span>
          <input
            type="date"
            value={state.patientBirthDate}
            onChange={(e) => update({ patientBirthDate: e.target.value })}
            className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink focus:border-ink focus:outline-none"
          />
        </label>
      </div>

      <label className="block text-sm space-y-1">
        <span className="text-body">Type de cancer</span>
        <select
          value={state.cancerType}
          onChange={(e) => update({ cancerType: e.target.value })}
          className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink focus:border-ink focus:outline-none"
        >
          {CANCER_PROFILE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {isCustom && (
        <div className="space-y-4 rounded-lg border border-hairline bg-canvas-soft p-4">
          <label className="block text-sm space-y-1">
            <span className="text-body">Nom du cancer</span>
            <input
              value={state.customCancerLabel}
              onChange={(e) => update({ customCancerLabel: e.target.value })}
              placeholder="ex : Carcinome rénal à cellules claires"
              className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink focus:border-ink focus:outline-none"
            />
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-body">Marqueurs biologiques (optionnel)</span>
              <button
                onClick={addMarker}
                className="text-xs text-ink hover:text-ink"
              >
                + Ajouter
              </button>
            </div>
            {state.customMarkers.map((m, i) => (
              <div key={i} className="grid grid-cols-7 gap-2 mb-2">
                <input
                  placeholder="clé"
                  value={m.key}
                  onChange={(e) => updateMarker(i, { key: e.target.value })}
                  className="col-span-2 h-9 px-2 rounded bg-surface-card border border-hairline-strong text-sm text-ink"
                />
                <input
                  placeholder="libellé"
                  value={m.label}
                  onChange={(e) => updateMarker(i, { label: e.target.value })}
                  className="col-span-3 h-9 px-2 rounded bg-surface-card border border-hairline-strong text-sm text-ink"
                />
                <input
                  placeholder="unité"
                  value={m.unit}
                  onChange={(e) => updateMarker(i, { unit: e.target.value })}
                  className="col-span-1 h-9 px-2 rounded bg-surface-card border border-hairline-strong text-sm text-ink"
                />
                <button
                  onClick={() => removeMarker(i)}
                  className="col-span-1 h-9 rounded border border-hairline-strong text-xs text-muted hover:text-error"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="h-11 px-5 rounded-lg border border-hairline-strong text-body hover:border-hairline-strong"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="h-11 px-5 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-on-primary font-medium"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
