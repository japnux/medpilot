"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  WELLBEING_LEVELS,
  VITAL_SIGNS,
  severityColor,
  type SymptomCategory,
  type WellbeingLevel,
} from "@/lib/symptoms";
import type { CatalogEntry } from "@/lib/symptom-catalog";
import { AlertTriangle, Phone, Plus, X } from "lucide-react";

interface PendingItem {
  category: SymptomCategory;
  symptom_type: string;
  symptom_label: string;
  severity?: number | null;
  numeric_value?: number | null;
  numeric_value_2?: number | null;
  numeric_unit?: string | null;
  source?: "kb" | "common" | "vital";
}

interface Props {
  familyId: string;
  catalog: CatalogEntry[];
}

/**
 * Saisie rapide quotidienne. Mobile-first. Steps libres :
 * 1. Score bien-être (1-5 emoji)
 * 2. Chips de symptômes (KB en premier, communs ensuite) → ajout en liste
 * 3. Mesures vitales en modal
 * 4. Note libre
 * 5. Submit batch via /api/symptoms/quick-checkin
 */
export default function QuickLogger({ familyId, catalog }: Props) {
  const router = useRouter();
  const [wellbeing, setWellbeing] = useState<number | null>(null);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [notes, setNotes] = useState("");
  const [showVitalModal, setShowVitalModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redFlag, setRedFlag] = useState<
    | {
        title?: string;
        severity?: string;
        rationale?: string;
        action?: string;
      }
    | null
  >(null);

  function addFromCatalog(c: CatalogEntry) {
    if (items.some((i) => i.symptom_type === c.type)) return;
    setItems([
      ...items,
      {
        category: c.category,
        symptom_type: c.type,
        symptom_label: c.label,
        severity: 5,
        source: c.source,
      },
    ]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateSeverity(idx: number, v: number) {
    const next = [...items];
    next[idx] = { ...next[idx], severity: v };
    setItems(next);
  }

  function addVitalSign(payload: PendingItem) {
    setItems([...items, payload]);
    setShowVitalModal(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    setRedFlag(null);
    try {
      const res = await fetch("/api/symptoms/quick-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          wellbeing_score: wellbeing,
          notes: notes.trim() || null,
          items: items.map((it) => ({
            category: it.category,
            symptom_type: it.symptom_type,
            symptom_label: it.symptom_label,
            severity: it.severity ?? null,
            numeric_value: it.numeric_value ?? null,
            numeric_value_2: it.numeric_value_2 ?? null,
            numeric_unit: it.numeric_unit ?? null,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur");
      if (j.red_flag) {
        setRedFlag(j.red_flag);
      } else {
        router.push("/symptoms");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const isEmergency = wellbeing === 1;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink">Check-in</h1>
          <p className="text-sm text-muted mt-1">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/symptoms")}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-muted hover:text-ink hover:bg-surface-card"
          aria-label="Fermer le check-in"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Fermer</span>
        </button>
      </header>

      {/* Score bien-être */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">
          Comment ça va aujourd&apos;hui ?
        </h2>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {WELLBEING_LEVELS.map((w) => (
            <WellbeingButton
              key={w.score}
              level={w}
              active={wellbeing === w.score}
              onClick={() => setWellbeing(w.score)}
            />
          ))}
        </div>
        {isEmergency && (
          <div className="rounded-lg border border-error/40 bg-error/5 p-3 text-sm text-error">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium">
                  Si urgence vitale : appelle le 15 (SAMU) ou le 112.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="tel:15"
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded bg-error text-canvas hover:bg-error/90"
                  >
                    <Phone className="w-3.5 h-3.5" /> Appeler 15
                  </a>
                  <a
                    href="tel:112"
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-error text-error hover:bg-error/10"
                  >
                    <Phone className="w-3.5 h-3.5" /> 112
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Chips symptômes */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink">
          Symptômes ressentis (clic pour ajouter)
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {catalog.map((c) => {
            const added = items.some((i) => i.symptom_type === c.type);
            return (
              <button
                key={c.type}
                type="button"
                onClick={() => addFromCatalog(c)}
                disabled={added}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs border transition-colors ${
                  added
                    ? "border-hairline bg-canvas-soft text-muted-soft cursor-not-allowed"
                    : c.source === "kb"
                      ? "border-purple-500/40 bg-purple-500/5 text-purple-600 hover:bg-purple-500/10"
                      : "border-hairline bg-canvas text-body hover:bg-surface-card"
                }`}
                title={c.related_medication ? `Lié à ${c.related_medication}` : undefined}
              >
                {!added && <Plus className="w-3 h-3" />}
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Items ajoutés */}
      {items.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-ink">Items ajoutés</h2>
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li
                key={idx}
                className="rounded-lg border border-hairline bg-surface-card p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {it.symptom_label}
                    </p>
                    {it.severity != null && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-muted">Sévérité</span>
                          <span
                            className="font-medium"
                            style={{ color: severityColor(it.severity) }}
                          >
                            {it.severity}/10
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={it.severity}
                          onChange={(e) =>
                            updateSeverity(idx, parseInt(e.target.value, 10))
                          }
                          className="w-full"
                          style={{
                            accentColor: severityColor(it.severity),
                          }}
                        />
                      </div>
                    )}
                    {it.numeric_value != null && (
                      <p className="text-xs text-muted mt-1">
                        {it.numeric_value_2 != null
                          ? `${it.numeric_value} / ${it.numeric_value_2}`
                          : it.numeric_value}{" "}
                        {it.numeric_unit}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="shrink-0 w-7 h-7 rounded-md text-muted hover:text-error hover:bg-surface-strong flex items-center justify-center"
                    aria-label="Retirer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Signes vitaux */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink">Mesures (optionnel)</h2>
        <div className="flex flex-wrap gap-1.5">
          {VITAL_SIGNS.map((v) => (
            <button
              key={v.type}
              type="button"
              onClick={() => setShowVitalModal(v.type)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs border border-hairline bg-canvas text-body hover:bg-surface-card"
            >
              <Plus className="w-3 h-3" /> {v.label}
            </button>
          ))}
        </div>
      </section>

      {/* Note libre */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink">Note du jour (optionnel)</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Ex : la fatigue augmente depuis 3 jours, surtout l'après-midi."
          className="w-full text-sm border border-hairline rounded-md px-3 py-2"
        />
      </section>

      {error && (
        <p className="text-sm text-error rounded-md border border-error/30 bg-error/5 p-3">
          {error}
        </p>
      )}

      {redFlag && (
        <div className="rounded-lg border-2 border-error bg-error/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-error">
                Red flag détecté : {redFlag.title}
              </p>
              {redFlag.rationale && (
                <p className="text-sm text-body mt-1">{redFlag.rationale}</p>
              )}
              {redFlag.action && (
                <p className="text-sm text-body-strong mt-2">
                  <span className="text-muted">Conduite à tenir : </span>
                  {redFlag.action}
                </p>
              )}
              {redFlag.severity === "vital" && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <a
                    href="tel:15"
                    className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded bg-error text-canvas hover:bg-error/90"
                  >
                    <Phone className="w-4 h-4" /> Appeler le 15
                  </a>
                  <a
                    href="tel:112"
                    className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded border border-error text-error hover:bg-error/10"
                  >
                    <Phone className="w-4 h-4" /> 112
                  </a>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  router.push("/symptoms");
                  router.refresh();
                }}
                className="mt-3 text-xs underline text-muted hover:text-ink"
              >
                J&apos;ai pris connaissance, voir l&apos;historique
              </button>
            </div>
          </div>
        </div>
      )}

      {!redFlag && (
        <button
          type="button"
          onClick={submit}
          disabled={saving || (wellbeing == null && items.length === 0)}
          className="w-full px-4 py-3 rounded-md bg-ink text-canvas text-sm font-medium hover:bg-ink/90 disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer le check-in"}
        </button>
      )}

      {showVitalModal && (
        <VitalSignModal
          type={showVitalModal}
          onClose={() => setShowVitalModal(null)}
          onAdd={addVitalSign}
        />
      )}
    </div>
  );
}

function WellbeingButton({
  level,
  active,
  onClick,
}: {
  level: WellbeingLevel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all ${
        active
          ? "border-ink scale-105"
          : "border-hairline hover:border-hairline-strong"
      }`}
      style={{
        backgroundColor: active ? `${level.color}1a` : undefined,
      }}
    >
      <span className="text-2xl">{level.emoji}</span>
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: active ? level.color : undefined }}
      >
        {level.label}
      </span>
    </button>
  );
}

function VitalSignModal({
  type,
  onClose,
  onAdd,
}: {
  type: string;
  onClose: () => void;
  onAdd: (item: PendingItem) => void;
}) {
  const preset = VITAL_SIGNS.find((v) => v.type === type);
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  if (!preset) return null;

  function submit() {
    const num1 = parseFloat(v1.replace(",", "."));
    if (Number.isNaN(num1)) return;
    let num2: number | null = null;
    if (preset && preset.fields === 2) {
      num2 = parseFloat(v2.replace(",", "."));
      if (Number.isNaN(num2)) return;
    }
    onAdd({
      category: "vital_sign",
      symptom_type: preset!.type,
      symptom_label: preset!.label,
      numeric_value: num1,
      numeric_value_2: num2,
      numeric_unit: preset!.unit,
      source: "vital",
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-canvas rounded-xl border border-hairline shadow-xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-hairline">
          <h3 className="text-base font-medium text-ink">{preset.label}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md text-muted hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="p-4 space-y-3">
          {preset.fields === 2 ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={v1}
                onChange={(e) => setV1(e.target.value)}
                placeholder="Systolique"
                className="flex-1 text-sm border border-hairline rounded-md px-3 py-2"
              />
              <span className="text-muted">/</span>
              <input
                type="number"
                inputMode="decimal"
                value={v2}
                onChange={(e) => setV2(e.target.value)}
                placeholder="Diastolique"
                className="flex-1 text-sm border border-hairline rounded-md px-3 py-2"
              />
              <span className="text-xs text-muted">{preset.unit}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={v1}
                onChange={(e) => setV1(e.target.value)}
                placeholder="Valeur"
                className="flex-1 text-sm border border-hairline rounded-md px-3 py-2"
              />
              <span className="text-xs text-muted">{preset.unit}</span>
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 p-4 border-t border-hairline">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-md border border-hairline-strong text-body hover:text-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            className="text-xs px-3 py-2 rounded-md bg-ink text-canvas hover:bg-ink/90"
          >
            Ajouter
          </button>
        </footer>
      </div>
    </div>
  );
}
