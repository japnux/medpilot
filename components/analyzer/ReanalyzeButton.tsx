"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

/**
 * Bouton "Ré-analyser" : re-passe le PDF stocké à Claude pour rafraîchir
 * `analysis_summary` (utile après une évolution du prompt).
 * Inactif si pas de storage_path côté DB (le parent décide de l'affichage).
 */
export default function ReanalyzeButton({
  documentId,
  className,
}: {
  documentId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!confirm("Re-passer ce document à Claude ?\n(coût Opus 4.7 ~ 0,05€)"))
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/reanalyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Erreur inconnue");
      } else {
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 text-xs h-9 px-3 rounded-md border border-hairline bg-canvas-soft text-body hover:text-ink hover:bg-surface-card disabled:opacity-50 transition-colors ${className ?? ""}`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {busy ? "Ré-analyse…" : "Ré-analyser"}
      </button>
      {error && (
        <span className="text-[10px] text-red-600 max-w-[200px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}
