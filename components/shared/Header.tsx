import { formatDateFr } from "@/lib/dates";

interface Props {
  patientName: string | null;
  cancerLabel: string;
  stage: string | null;
  activeTreatments: string[];
  lastUpdate: string | null;
}

/**
 * Header app : affiche le contexte patient en permanence.
 * Patient · Cancer · Stade · Traitements · Dernière mise à jour
 */
export default function Header({
  patientName,
  cancerLabel,
  stage,
  activeTreatments,
  lastUpdate,
}: Props) {
  return (
    <header className="border-b border-hairline bg-canvas-soft px-6 py-3">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="font-medium text-ink">
          {patientName ?? "Patient"}
        </span>
        <span className="text-muted-soft">·</span>
        <span className="text-body">{cancerLabel}</span>
        {stage && (
          <>
            <span className="text-muted-soft">·</span>
            <span className="px-2 py-0.5 rounded text-xs bg-surface-strong text-body">
              {stage}
            </span>
          </>
        )}
        {activeTreatments.length > 0 && (
          <>
            <span className="text-muted-soft">·</span>
            <div className="flex gap-1.5 flex-wrap">
              {activeTreatments.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded text-xs bg-surface-strong text-ink border border-hairline-strong"
                >
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
        <span className="ml-auto text-xs text-muted">
          Maj : {formatDateFr(lastUpdate)}
        </span>
      </div>
    </header>
  );
}
