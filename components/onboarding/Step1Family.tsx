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
        <h2 className="text-2xl font-semibold text-ink">
          Créons votre dossier familial
        </h2>
        <p className="text-sm text-muted mt-1">
          MedPilot regroupe les données d&apos;un cas médical au sein d&apos;une famille.
          Vous pourrez inviter les proches à l&apos;étape 4.
        </p>
      </div>

      <label className="block text-sm space-y-1">
        <span className="text-body">Nom du cas / de la famille</span>
        <input
          value={state.familyName}
          onChange={(e) => update({ familyName: e.target.value })}
          placeholder="ex : Famille Vidal"
          className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink focus:border-ink focus:outline-none"
        />
      </label>

      <label className="block text-sm space-y-1">
        <span className="text-body">Votre prénom (comment vous voulez être affiché)</span>
        <input
          value={state.creatorDisplayName}
          onChange={(e) => update({ creatorDisplayName: e.target.value })}
          placeholder="ex : Geoffrey"
          className="w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink focus:border-ink focus:outline-none"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm text-body mb-1">Votre rôle</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["patient", "accompagnant"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update({ creatorRole: r })}
              className={`h-11 rounded-lg border text-sm capitalize ${
                state.creatorRole === r
                  ? "border-ink bg-surface-strong text-ink"
                  : "border-hairline-strong text-muted hover:border-hairline-strong"
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
          className="h-11 px-5 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-on-primary font-medium"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
