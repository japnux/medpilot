"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

/**
 * Bouton "Ré-analyser" : re-passe le PDF stocké à Claude pour rafraîchir
 * `analysis_summary`. Pendant la requête, un overlay plein écran freeze
 * l'UI du document (bloque les interactions + affiche un spinner).
 * Pas de toast — l'overlay disparait quand la nouvelle analyse est prête
 * et la page est re-fetched.
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
        // router.refresh() recharge la page server-side → l'analyse est
        // fraîche quand l'utilisateur reprend la main. On garde l'overlay
        // jusqu'à ce que la transition soit terminée.
        await new Promise<void>((resolve) => {
          startTransition(() => {
            router.refresh();
            resolve();
          });
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const isRunning = busy || pending;

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={run}
          disabled={isRunning}
          className={`inline-flex items-center gap-1.5 text-xs h-9 px-3 rounded-md border border-hairline bg-canvas-soft text-body hover:text-ink hover:bg-surface-card disabled:opacity-50 transition-colors ${className ?? ""}`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${busy ? "animate-pulse" : ""}`} />
          {busy ? "Ré-analyse…" : "Ré-analyser"}
        </button>
        {error && (
          <span className="text-[10px] text-error max-w-[220px] text-right">
            {error}
          </span>
        )}
      </div>

      {isRunning && <FreezeOverlay />}
    </>
  );
}

/**
 * Overlay plein écran pendant la ré-analyse : bloque toutes les interactions
 * sur la page et affiche un spinner centré. Le z-index est au-dessus du
 * hamburger mobile (z-50) et de tout modal éventuel.
 */
function FreezeOverlay() {
  return (
    <div
      className="fixed inset-0 z-[60] bg-canvas/85 backdrop-blur-sm flex items-center justify-center cursor-wait"
      role="alert"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl bg-canvas border border-hairline shadow-lg px-6 py-5 max-w-xs text-center">
        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
        <div>
          <p className="text-sm font-medium text-ink">
            Ré-analyse en cours
          </p>
          <p className="text-xs text-muted mt-1">
            Claude relit le document. Cela peut prendre 20 à 40 secondes.
          </p>
        </div>
      </div>
    </div>
  );
}
