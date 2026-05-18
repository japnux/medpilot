"use client";

import { useState } from "react";
import { TONE_META, type TonePreference } from "@/lib/tone";

/**
 * Sélecteur compact de tonalité par membre. Réservé à l'admin (la page
 * /admin/families est déjà protégée par ADMIN_EMAILS).
 * Pas de confirmation : un dropdown qui PATCH immédiatement.
 */
export default function UserToneSelector({
  userId,
  initialTone,
}: {
  userId: string;
  initialTone: TonePreference;
}) {
  const [tone, setTone] = useState<TonePreference>(initialTone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: TonePreference) {
    if (next === tone) return;
    const previous = tone;
    setTone(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/user-tone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, tone_preference: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Erreur");
      }
    } catch (e) {
      setTone(previous);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const current = TONE_META[tone];

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <select
        value={tone}
        onChange={(e) => change(e.target.value as TonePreference)}
        disabled={saving}
        title={`Tonalité d'affichage : ${current.label}`}
        className="text-xs h-7 px-2 rounded border border-hairline bg-canvas text-body hover:text-ink disabled:opacity-50 cursor-pointer"
      >
        {(["medical", "balanced", "soft"] as const).map((t) => (
          <option key={t} value={t}>
            {TONE_META[t].emoji} {TONE_META[t].label}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  );
}
