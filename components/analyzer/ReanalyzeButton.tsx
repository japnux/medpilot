"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";

interface ReanalyzeStats {
  prescriptions_count: number;
  decisions_count: number;
  questions_count: number;
  key_values_count: number;
  surveillance_count: number;
  analysis_updated_at: string;
  duration_ms: number;
}

/**
 * Bouton "Ré-analyser" : re-passe le PDF stocké à Claude pour rafraîchir
 * `analysis_summary`. Au succès, affiche un toast persistant avec les
 * compteurs (prescriptions, décisions, questions, …) pour confirmer
 * visuellement que la ré-analyse a tourné.
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
  const [success, setSuccess] = useState<ReanalyzeStats | null>(null);

  // Auto-dismiss du toast après 8 secondes (l'utilisateur peut aussi fermer
  // manuellement). Les stats restent disponibles jusqu'à la fermeture.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 8000);
    return () => clearTimeout(t);
  }, [success]);

  async function run() {
    if (!confirm("Re-passer ce document à Claude ?\n(coût Opus 4.7 ~ 0,05€)"))
      return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/reanalyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Erreur inconnue");
      } else {
        setSuccess({
          prescriptions_count: data.prescriptions_count ?? 0,
          decisions_count: data.decisions_count ?? 0,
          questions_count: data.questions_count ?? 0,
          key_values_count: data.key_values_count ?? 0,
          surveillance_count: data.surveillance_count ?? 0,
          analysis_updated_at: data.analysis_updated_at ?? new Date().toISOString(),
          duration_ms: data.duration_ms ?? 0,
        });
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
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={run}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 text-xs h-9 px-3 rounded-md border border-hairline bg-canvas-soft text-body hover:text-ink hover:bg-surface-card disabled:opacity-50 transition-colors ${className ?? ""}`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${busy ? "animate-pulse" : ""}`} />
          {busy ? "Ré-analyse en cours…" : "Ré-analyser"}
        </button>
        {error && (
          <span className="text-[10px] text-error max-w-[200px] text-right">
            {error}
          </span>
        )}
      </div>

      {success && <SuccessToast stats={success} onClose={() => setSuccess(null)} />}
    </>
  );
}

function SuccessToast({
  stats,
  onClose,
}: {
  stats: ReanalyzeStats;
  onClose: () => void;
}) {
  const items: { label: string; count: number }[] = [
    { label: "prescription", count: stats.prescriptions_count },
    { label: "décision", count: stats.decisions_count },
    { label: "question", count: stats.questions_count },
    { label: "valeur clé", count: stats.key_values_count },
    { label: "surveillance", count: stats.surveillance_count },
  ].filter((i) => i.count > 0);

  const seconds = (stats.duration_ms / 1000).toFixed(1);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-success/40 bg-success/10 text-success-strong shadow-lg p-3 pr-9 animate-in slide-in-from-bottom-2">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md text-muted hover:text-ink hover:bg-canvas flex items-center justify-center"
        aria-label="Fermer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-2">
        <Check className="w-4 h-4 shrink-0 mt-0.5 text-success" />
        <div className="text-xs space-y-1.5">
          <p className="font-medium text-success">
            Document ré-analysé en {seconds}s
          </p>
          {items.length === 0 ? (
            <p className="text-body">
              Analyse mise à jour. Aucun élément structuré extrait.
            </p>
          ) : (
            <ul className="text-body space-y-0.5">
              {items.map((it) => (
                <li key={it.label}>
                  • {it.count} {it.label}
                  {it.count > 1 ? "s" : ""}{" "}
                  {it.label === "prescription" || it.label === "décision"
                    ? "extraite" + (it.count > 1 ? "s" : "")
                    : ""}
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted text-[11px]">
            La page s&apos;actualise automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}
