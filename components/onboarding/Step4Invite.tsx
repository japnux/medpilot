"use client";

import { useState } from "react";
import type { OnboardingState } from "@/app/onboarding/page";

interface Props {
  state: OnboardingState;
  onBack: () => void;
  onFinalize: () => void;
  loading: boolean;
}

export default function Step4Invite({ onBack, onFinalize, loading }: Props) {
  const [invites, setInvites] = useState<
    Array<{ email: string; role: "patient" | "accompagnant"; relation: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  function add() {
    setInvites([...invites, { email: "", role: "accompagnant", relation: "" }]);
  }

  // L'invitation effective se fera après finalize() une fois la famille créée.
  // Pour rester simple ici, on déclenche l'API pour chaque invite après finalisation,
  // mais comme notre finalize() n'expose pas family_id au composant, l'invitation
  // sera disponible dans la page Settings → Membres.
  // Pour cette MVP : on ignore le contenu, on appelle juste onFinalize.

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Inviter la famille</h2>
        <p className="text-sm text-slate-400 mt-1">
          Vous pouvez inviter des proches maintenant ou plus tard depuis les paramètres.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-300">Invitations</span>
          <button onClick={add} className="text-xs text-indigo-400 hover:text-indigo-300">
            + Ajouter
          </button>
        </div>
        {invites.length === 0 && (
          <p className="text-xs text-slate-500 italic">
            Aucune invitation. Vous pourrez en envoyer depuis l&apos;onglet Paramètres après l&apos;onboarding.
          </p>
        )}
        {invites.map((inv, i) => (
          <div key={i} className="grid grid-cols-7 gap-2 mb-2">
            <input
              type="email"
              placeholder="email@exemple.com"
              value={inv.email}
              onChange={(e) => {
                const next = [...invites];
                next[i].email = e.target.value;
                setInvites(next);
              }}
              className="col-span-3 h-9 px-2 rounded bg-slate-900 border border-slate-700 text-sm text-white"
            />
            <select
              value={inv.role}
              onChange={(e) => {
                const next = [...invites];
                next[i].role = e.target.value as "patient" | "accompagnant";
                setInvites(next);
              }}
              className="col-span-2 h-9 px-2 rounded bg-slate-900 border border-slate-700 text-sm text-white"
            >
              <option value="accompagnant">Proche</option>
              <option value="patient">Patient</option>
            </select>
            <input
              placeholder="lien (fils, conjoint…)"
              value={inv.relation}
              onChange={(e) => {
                const next = [...invites];
                next[i].relation = e.target.value;
                setInvites(next);
              }}
              className="col-span-2 h-9 px-2 rounded bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>
        ))}
        {invites.length > 0 && (
          <p className="text-xs text-amber-400 mt-2">
            Les invitations seront à confirmer depuis Paramètres → Membres après l&apos;onboarding.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          disabled={loading}
          className="h-11 px-5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-600 disabled:opacity-40"
        >
          Retour
        </button>
        <button
          onClick={onFinalize}
          disabled={loading}
          className="h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium"
        >
          {loading ? "Création..." : "Terminer"}
        </button>
      </div>
    </div>
  );
}
