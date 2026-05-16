"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Bouton client : déclenche POST /api/admin/sync-changelog.
 * Affiche un état pendant l'opération (peut prendre 1-2 min).
 */
export default function SyncButton({ limit = 100 }: { limit?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sync-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Erreur : ${data?.error ?? "inconnue"}`);
      } else {
        setMsg(
          `✓ ${data.new_entries} entrée${data.new_entries > 1 ? "s" : ""} ajoutée${data.new_entries > 1 ? "s" : ""}`,
        );
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setMsg(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={sync}
        disabled={disabled}
        className="px-3 py-1.5 text-sm rounded-md bg-ink text-canvas hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {busy ? "Synchronisation…" : "Synchroniser depuis GitHub"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
