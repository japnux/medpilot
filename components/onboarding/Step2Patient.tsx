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
        <h2 className="text-2xl font-semibold text-white">Profil du patient</h2>
        <p className="text-sm text-slate-400 mt-1">
          Informations de base et type de cancer.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm space-y-1">
          <span className="text-slate-300">Prénom du patient</span>
          <input
            value={state.patientFirstName}
            onChange={(e) => update({ patientFirstName: e.target.value })}
            className="w-full h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-slate-300">Date de naissance</span>
          <input
            type="date"
            value={state.patientBirthDate}
            onChange={(e) => update({ patientBirthDate: e.target.value })}
            className="w-full h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
          />
        </label>
      </div>

      <label className="block text-sm space-y-1">
        <span className="text-slate-300">Type de cancer</span>
        <select
          value={state.cancerType}
          onChange={(e) => update({ cancerType: e.target.value })}
          className="w-full h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
        >
          {CANCER_PROFILE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {isCustom && (
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <label className="block text-sm space-y-1">
            <span className="text-slate-300">Nom du cancer</span>
            <input
              value={state.customCancerLabel}
              onChange={(e) => update({ customCancerLabel: e.target.value })}
              placeholder="ex : Carcinome rénal à cellules claires"
              className="w-full h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Marqueurs biologiques (optionnel)</span>
              <button
                onClick={addMarker}
                className="text-xs text-indigo-400 hover:text-indigo-300"
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
                  className="col-span-2 h-9 px-2 rounded bg-slate-900 border border-slate-700 text-sm text-white"
                />
                <input
                  placeholder="libellé"
                  value={m.label}
                  onChange={(e) => updateMarker(i, { label: e.target.value })}
                  className="col-span-3 h-9 px-2 rounded bg-slate-900 border border-slate-700 text-sm text-white"
                />
                <input
                  placeholder="unité"
                  value={m.unit}
                  onChange={(e) => updateMarker(i, { unit: e.target.value })}
                  className="col-span-1 h-9 px-2 rounded bg-slate-900 border border-slate-700 text-sm text-white"
                />
                <button
                  onClick={() => removeMarker(i)}
                  className="col-span-1 h-9 rounded border border-slate-700 text-xs text-slate-400 hover:text-red-400"
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
          className="h-11 px-5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-600"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
