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
    <header className="border-b border-slate-800 bg-slate-950/40 px-6 py-3">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="font-medium text-white">
          {patientName ?? "Patient"}
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-300">{cancerLabel}</span>
        {stage && (
          <>
            <span className="text-slate-600">·</span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
              {stage}
            </span>
          </>
        )}
        {activeTreatments.length > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <div className="flex gap-1.5 flex-wrap">
              {activeTreatments.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
        <span className="ml-auto text-xs text-slate-500">
          Maj : {formatDateFr(lastUpdate)}
        </span>
      </div>
    </header>
  );
}
