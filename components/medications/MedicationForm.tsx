"use client";

import { useEffect, useState } from "react";
import { X, AlertCircle, Link2, ChevronDown, ChevronRight } from "lucide-react";
import type { MedicationRoute, MedicationStatus } from "@/types/database";
import {
  FORM_OPTIONS,
  ROUTE_OPTIONS,
  STATUS_OPTIONS,
  type Medication,
} from "@/lib/medications-helpers";
import MedicationNameAutocomplete, {
  type MedicationReference,
} from "./MedicationNameAutocomplete";

interface Props {
  /** Si fourni, mode édition. Sinon, mode création. */
  initial?: Medication | null;
  /** Liste des médicaments existants (pour le warning de doublon de nom). */
  existing: Medication[];
  /** Statut pré-sélectionné si création (ex: "Arrêter" → "stopped"). */
  defaultStatus?: MedicationStatus;
  onClose: () => void;
  onSaved: (m: Medication) => void;
}

interface FormState {
  name: string;
  brand_name: string;
  active_ingredient: string;
  dosage: string;
  form: string;
  posology: string;
  route: MedicationRoute;
  indication: string;
  prescriber: string;
  started_at: string;
  ended_at: string;
  status: MedicationStatus;
  status_reason: string;
  notes: string;
  wikipedia_url: string;
  vidal_url: string;
  ansm_url: string;
  known_side_effects: string;
}

function toFormState(m: Medication | null, defaultStatus: MedicationStatus): FormState {
  return {
    name: m?.name ?? "",
    brand_name: m?.brand_name ?? "",
    active_ingredient: m?.active_ingredient ?? "",
    dosage: m?.dosage ?? "",
    form: m?.form ?? "",
    posology: m?.posology ?? "",
    route: m?.route ?? "oral",
    indication: m?.indication ?? "",
    prescriber: m?.prescriber ?? "",
    started_at: m?.started_at ?? "",
    ended_at: m?.ended_at ?? "",
    status: m?.status ?? defaultStatus,
    status_reason: m?.status_reason ?? "",
    notes: m?.notes ?? "",
    wikipedia_url: m?.wikipedia_url ?? "",
    vidal_url: m?.vidal_url ?? "",
    ansm_url: m?.ansm_url ?? "",
    known_side_effects: m?.known_side_effects ?? "",
  };
}

/** Effets indésirables prefillés depuis une référence : un par ligne. */
function formatSideEffectsFromRef(common: unknown): string {
  if (!Array.isArray(common)) return "";
  return common
    .filter((s): s is string => typeof s === "string")
    .map((s) => `• ${s}`)
    .join("\n");
}

/**
 * Modal de création / édition d'un médicament. Form maison (pas de Radix dans
 * les deps). Validation : name + posology obligatoires (zod côté API en miroir).
 */
export default function MedicationForm({
  initial,
  existing,
  defaultStatus = "active",
  onClose,
  onSaved,
}: Props) {
  const [state, setState] = useState<FormState>(() =>
    toFormState(initial ?? null, defaultStatus),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sections repliables (URLs et effets indésirables) — repliées par défaut sauf
  // si l'utilisateur édite un médicament qui en a déjà.
  const hasAnyLink = Boolean(
    initial?.wikipedia_url || initial?.vidal_url || initial?.ansm_url,
  );
  const [linksOpen, setLinksOpen] = useState(hasAnyLink);
  const [sideOpen, setSideOpen] = useState(Boolean(initial?.known_side_effects));

  // Empêche le scroll arrière + escape pour fermer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  /**
   * Prefill depuis une référence : remplit les champs vides uniquement
   * (ne pas écraser ce que l'utilisateur a déjà saisi). Ouvre les sections
   * URLs/effets si la référence en apporte.
   */
  function handlePickReference(ref: MedicationReference) {
    setState((s) => ({
      ...s,
      name: ref.name,
      brand_name: s.brand_name || ref.brand_name || "",
      active_ingredient:
        s.active_ingredient || ref.active_ingredient || "",
      indication: s.indication || ref.default_indication || "",
      wikipedia_url: s.wikipedia_url || ref.wikipedia_url || "",
      vidal_url: s.vidal_url || ref.vidal_url || "",
      ansm_url: s.ansm_url || ref.ansm_url || "",
      known_side_effects:
        s.known_side_effects || formatSideEffectsFromRef(ref.common_side_effects),
    }));
    if (ref.wikipedia_url || ref.vidal_url || ref.ansm_url) setLinksOpen(true);
    if (Array.isArray(ref.common_side_effects) && ref.common_side_effects.length > 0) {
      setSideOpen(true);
    }
  }

  const showEndDate = state.status === "stopped";
  const showReason = state.status === "stopped" || state.status === "paused";

  // Détection doublon (par nom, hors l'enregistrement en cours d'édition)
  const trimmedName = state.name.trim().toLowerCase();
  const duplicate =
    trimmedName.length > 0 &&
    existing.some(
      (m) =>
        m.id !== initial?.id && m.name.trim().toLowerCase() === trimmedName,
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      name: state.name.trim(),
      brand_name: state.brand_name.trim() || null,
      active_ingredient: state.active_ingredient.trim() || null,
      dosage: state.dosage.trim() || null,
      form: state.form.trim() || null,
      posology: state.posology.trim(),
      route: state.route,
      indication: state.indication.trim() || null,
      prescriber: state.prescriber.trim() || null,
      started_at: state.started_at || null,
      ended_at: state.ended_at || null,
      status: state.status,
      status_reason: state.status_reason.trim() || null,
      notes: state.notes.trim() || null,
      wikipedia_url: state.wikipedia_url.trim() || null,
      vidal_url: state.vidal_url.trim() || null,
      ansm_url: state.ansm_url.trim() || null,
      known_side_effects: state.known_side_effects.trim() || null,
    };

    if (!payload.name || !payload.posology) {
      setError("Le nom et la posologie sont obligatoires.");
      return;
    }

    setSubmitting(true);
    try {
      const url = initial
        ? `/api/medications/${initial.id}`
        : "/api/medications";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        medication?: Medication;
        error?: string;
      };
      if (!res.ok || !json.medication) {
        throw new Error(json.error ?? "Erreur réseau");
      }
      onSaved(json.medication);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink/40"
      />
      {/* Panel droite */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Éditer le médicament" : "Ajouter un médicament"}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-canvas shadow-2xl flex flex-col"
      >
        <header className="px-5 py-4 border-b border-hairline flex items-center justify-between">
          <h2 className="text-base font-medium text-ink">
            {initial ? "Éditer le médicament" : "Ajouter un médicament"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-surface-card text-muted hover:text-ink flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-body mb-1">
              Nom du médicament <span className="text-red-600">*</span>
            </label>
            <MedicationNameAutocomplete
              value={state.name}
              onChange={(v) => update("name", v)}
              onPick={handlePickReference}
              placeholder="Mitotane"
              required
            />
            <p className="mt-1 text-xs text-muted">
              Tapez les premières lettres pour suggérer une référence et préremplir les autres champs.
            </p>
            {duplicate && (
              <p className="mt-1 text-xs text-amber-700 inline-flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Un médicament avec ce nom existe déjà.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Nom de marque
              </label>
              <input
                type="text"
                value={state.brand_name}
                onChange={(e) => update("brand_name", e.target.value)}
                placeholder="Lysodren"
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Dosage
              </label>
              <input
                type="text"
                value={state.dosage}
                onChange={(e) => update("dosage", e.target.value)}
                placeholder="500 mg"
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Forme
              </label>
              <select
                value={state.form}
                onChange={(e) => update("form", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              >
                <option value="">—</option>
                {FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Voie d&apos;administration
              </label>
              <select
                value={state.route}
                onChange={(e) =>
                  update("route", e.target.value as MedicationRoute)
                }
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              >
                {ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-body mb-1">
              Posologie <span className="text-red-600">*</span>
            </label>
            <textarea
              required
              value={state.posology}
              onChange={(e) => update("posology", e.target.value)}
              placeholder="Ex : 1 cp matin et soir pendant un repas gras"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <p className="mt-1 text-xs text-muted">
              Texte libre. Conseil : indiquer dose × fréquence × moment / conditions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Indication
              </label>
              <input
                type="text"
                value={state.indication}
                onChange={(e) => update("indication", e.target.value)}
                placeholder="Adjuvant corticosurrénalome"
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Prescripteur
              </label>
              <input
                type="text"
                value={state.prescriber}
                onChange={(e) => update("prescriber", e.target.value)}
                placeholder="Dr Thoulouzan"
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-body mb-1">
              Date de début
            </label>
            <input
              type="date"
              value={state.started_at}
              onChange={(e) => update("started_at", e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-body mb-2">
              Statut
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer ${
                    state.status === o.value
                      ? "border-ink bg-surface-card"
                      : "border-hairline hover:bg-surface-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={o.value}
                    checked={state.status === o.value}
                    onChange={() => update("status", o.value)}
                    className="accent-ink"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          {showEndDate && (
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={state.ended_at}
                onChange={(e) => update("ended_at", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
              <p className="mt-1 text-xs text-muted">
                Si vide, la date d&apos;aujourd&apos;hui sera utilisée.
              </p>
            </div>
          )}

          {showReason && (
            <div>
              <label className="block text-xs font-medium text-body mb-1">
                Raison de l&apos;arrêt / suspension
              </label>
              <textarea
                value={state.status_reason}
                onChange={(e) => update("status_reason", e.target.value)}
                rows={2}
                placeholder="Ex : toxicité hépatique"
                className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
              />
            </div>
          )}

          {/* Section repliable : Liens officiels */}
          <div className="border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setLinksOpen((v) => !v)}
              className="w-full flex items-center justify-between text-left text-sm font-medium text-ink hover:text-body"
              aria-expanded={linksOpen}
            >
              <span className="inline-flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Liens officiels (Wikipedia, Vidal, ANSM)
              </span>
              {linksOpen ? (
                <ChevronDown className="w-4 h-4 text-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted" />
              )}
            </button>
            {linksOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-body mb-1">
                    Wikipedia
                  </label>
                  <input
                    type="url"
                    value={state.wikipedia_url}
                    onChange={(e) => update("wikipedia_url", e.target.value)}
                    placeholder="https://fr.wikipedia.org/wiki/…"
                    className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-body mb-1">
                    Vidal
                  </label>
                  <input
                    type="url"
                    value={state.vidal_url}
                    onChange={(e) => update("vidal_url", e.target.value)}
                    placeholder="https://www.vidal.fr/medicaments/…"
                    className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-body mb-1">
                    ANSM / Base publique
                  </label>
                  <input
                    type="url"
                    value={state.ansm_url}
                    onChange={(e) => update("ansm_url", e.target.value)}
                    placeholder="https://base-donnees-publique.medicaments.gouv.fr/…"
                    className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section repliable : Effets indésirables connus */}
          <div className="border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setSideOpen((v) => !v)}
              className="w-full flex items-center justify-between text-left text-sm font-medium text-ink hover:text-body"
              aria-expanded={sideOpen}
            >
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Effets indésirables connus
              </span>
              {sideOpen ? (
                <ChevronDown className="w-4 h-4 text-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted" />
              )}
            </button>
            {sideOpen && (
              <div className="mt-3">
                <textarea
                  value={state.known_side_effects}
                  onChange={(e) =>
                    update("known_side_effects", e.target.value)
                  }
                  rows={6}
                  placeholder="• Nausées&#10;• Fatigue&#10;• …"
                  className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
                />
                <p className="mt-1 text-xs text-muted">
                  Prérempli depuis la référence si vous sélectionnez un médicament dans l&apos;autocomplete. Modifiable.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-body mb-1">
              Notes
            </label>
            <textarea
              value={state.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Notes libres : chronologie de titration, effets indésirables observés…"
              className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </form>

        <footer className="px-5 py-3 border-t border-hairline flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 rounded-md text-sm text-body hover:bg-surface-card"
          >
            Annuler
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-ink text-canvas text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Enregistrement…" : initial ? "Enregistrer" : "Ajouter"}
          </button>
        </footer>
      </aside>
    </>
  );
}
