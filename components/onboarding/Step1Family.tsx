"use client";

import type { OnboardingState } from "@/app/onboarding/page";

interface Props {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

export default function Step1Family({ state, update, onNext }: Props) {
  const canNext =
    state.familyName.trim().length > 0 &&
    state.creatorDisplayName.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          Créons votre dossier familial
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          MedPilot regroupe les données d&apos;un cas médical au sein d&apos;une famille.
          Vous pourrez inviter les proches à l&apos;étape 4.
        </p>
      </div>

      <label className="block text-sm space-y-1">
        <span className="text-slate-300">Nom du cas / de la famille</span>
        <input
          value={state.familyName}
          onChange={(e) => update({ familyName: e.target.value })}
          placeholder="ex : Famille Vidal"
          className="w-full h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
        />
      </label>

      <label className="block text-sm space-y-1">
        <span className="text-slate-300">Votre prénom (comment vous voulez être affiché)</span>
        <input
          value={state.creatorDisplayName}
          onChange={(e) => update({ creatorDisplayName: e.target.value })}
          placeholder="ex : Geoffrey"
          className="w-full h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-indigo-500 focus:outline-none"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm text-slate-300 mb-1">Votre rôle</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["patient", "accompagnant"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update({ creatorRole: r })}
              className={`h-11 rounded-lg border text-sm capitalize ${
                state.creatorRole === r
                  ? "border-indigo-500 bg-indigo-500/10 text-white"
                  : "border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              {r === "patient" ? "Je suis le patient" : "Je suis un proche"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end pt-2">
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
