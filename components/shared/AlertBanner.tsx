import { AlertTriangle } from "lucide-react";

interface Props {
  title: string;
  message: string;
}

/**
 * Bannière d'alerte critique non dismissible.
 * À afficher en haut du dashboard quand au moins une mesure est en alert_level=critical.
 */
export default function AlertBanner({ title, message }: Props) {
  return (
    <div className="rounded-xl border border-error/30 bg-canvas-soft p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-error">{title}</p>
        <p className="text-xs text-error/80 mt-0.5">{message}</p>
      </div>
    </div>
  );
}
