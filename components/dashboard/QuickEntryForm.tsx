"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MarkerDef } from "@/lib/cancer-profiles";
import { today } from "@/lib/dates";

interface Props {
  familyId: string;
  markers: Record<string, MarkerDef>;
}

/**
 * Formulaire de saisie rapide d'un bilan biologique.
 * Date + champs dynamiques selon les marqueurs du profil cancer.
 * POST /api/biology/log → insère plusieurs biology_records + 1 timeline_event.
 */
export default function QuickEntryForm({ familyId, markers }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(today());
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const filled = Object.entries(values).filter(
      ([, v]) => v.trim() !== "" && !isNaN(parseFloat(v)),
    );
    if (filled.length === 0) {
      setError("Renseignez au moins une valeur.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/biology/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          recorded_at: date,
          measurements: filled.map(([key, value]) => ({
            marker_name: key,
            value: parseFloat(value),
            unit: markers[key].unit,
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erreur d'enregistrement");
      }
      setValues({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  const markerEntries = Object.entries(markers);

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-hairline bg-surface-card p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Saisie rapide d&apos;un bilan</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {markerEntries.map(([key, m]) => (
          <label key={key} className="text-xs space-y-1">
            <span className="text-muted">
              {m.label} <span className="text-muted-soft">({m.unit})</span>
            </span>
            <input
              type="number"
              step="any"
              value={values[key] ?? ""}
              onChange={(e) =>
                setValues({ ...values, [key]: e.target.value })
              }
              placeholder="—"
              className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink focus:border-ink focus:outline-none"
            />
          </label>
        ))}
      </div>

      {error && (
        <p className="text-xs text-error">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-sm font-medium text-on-primary"
        >
          {submitting ? "Enregistrement..." : "Enregistrer le bilan"}
        </button>
      </div>
    </form>
  );
}
