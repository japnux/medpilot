"use client";

import { useState } from "react";
import type { DocumentAnalysisResult } from "@/lib/prompts";
import { ThumbsUp, AlertCircle, Stethoscope, FileText, Copy, Check } from "lucide-react";

interface Props {
  result: DocumentAnalysisResult;
}

type Tab = "family" | "clinical" | "points" | "questions";

export default function AnalysisTabs({ result }: Props) {
  const [tab, setTab] = useState<Tab>("family");
  const [copied, setCopied] = useState(false);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "family", label: "Famille" },
    { key: "clinical", label: "Clinique" },
    { key: "points", label: "Points clés" },
    { key: "questions", label: "Questions" },
  ];

  function copyAllQuestions() {
    const txt = result.questions_for_team
      .map(
        (q, i) =>
          `${i + 1}. [${q.priority === "high" ? "PRIORITAIRE" : "normal"}] ${q.question} (${q.addressed_to})`,
      )
      .join("\n");
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden">
      <header className="border-b border-hairline px-4 pt-4">
        <h2 className="text-base font-medium text-ink">{result.title}</h2>
        {result.document_date && (
          <p className="text-xs text-muted mt-1">
            Daté du {result.document_date}
          </p>
        )}
        <nav className="flex gap-1 -mb-px mt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                tab === t.key
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="p-5">
        {tab === "family" && (
          <div className="space-y-3">
            <p className="text-lg text-ink leading-relaxed">
              {result.summary_family}
            </p>
            {result.action_required && result.action_details && (
              <div className="mt-4 rounded-lg border border-error/30 bg-canvas-soft p-3 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <p className="text-sm text-error">{result.action_details}</p>
              </div>
            )}
          </div>
        )}

        {tab === "clinical" && (
          <div className="space-y-4">
            <p className="text-sm text-body-strong leading-relaxed whitespace-pre-wrap">
              {result.summary_clinical}
            </p>
            {result.key_values.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-2 pr-2">Paramètre</th>
                      <th className="py-2 pr-2">Valeur</th>
                      <th className="py-2 pr-2">Référence</th>
                      <th className="py-2 pr-2">Interprétation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.key_values.map((kv, i) => (
                      <tr key={i} className="border-t border-hairline">
                        <td className="py-2 pr-2 text-body">{kv.parameter}</td>
                        <td className="py-2 pr-2 text-ink font-medium">
                          {kv.value} <span className="text-muted">{kv.unit}</span>
                        </td>
                        <td className="py-2 pr-2 text-muted">{kv.reference_range}</td>
                        <td className="py-2 pr-2 text-body">
                          <span className={statusBadgeClass(kv.status)}>{kv.status}</span>{" "}
                          {kv.interpretation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.surveillance_triggered.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-ink mb-2">
                  Examens à planifier
                </h4>
                <ul className="space-y-1.5 text-xs text-body">
                  {result.surveillance_triggered.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <Stethoscope className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                      <span>
                        <span className="text-ink">{s.exam}</span> · {s.delay} —{" "}
                        <span className="text-muted">{s.reason}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "points" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-lg border border-success/30 bg-success/5 p-4">
              <h4 className="text-sm font-medium text-success flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4" /> Favorables
              </h4>
              <ul className="space-y-1.5 text-xs text-body-strong">
                {result.favorable_points.length === 0 ? (
                  <li className="text-muted italic">Aucun point particulier</li>
                ) : (
                  result.favorable_points.map((p, i) => <li key={i}>• {p}</li>)
                )}
              </ul>
            </section>
            <section className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <h4 className="text-sm font-medium text-warning flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4" /> Préoccupants
              </h4>
              <ul className="space-y-1.5 text-xs text-body-strong">
                {result.concerning_points.length === 0 ? (
                  <li className="text-muted italic">Aucun</li>
                ) : (
                  result.concerning_points.map((p, i) => <li key={i}>• {p}</li>)
                )}
              </ul>
            </section>
          </div>
        )}

        {tab === "questions" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-ink">
                {result.questions_for_team.length} question
                {result.questions_for_team.length > 1 ? "s" : ""} pour l&apos;équipe
              </h4>
              <button
                onClick={copyAllQuestions}
                className="flex items-center gap-1.5 text-xs text-body hover:text-ink px-2.5 py-1.5 rounded border border-hairline-strong hover:border-hairline-strong"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copié" : "Copier tout"}
              </button>
            </div>
            <ul className="space-y-2">
              {result.questions_for_team.map((q, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-hairline bg-canvas-soft p-3 space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        q.priority === "high"
                          ? "bg-error/10 text-error"
                          : "bg-surface-strong text-body"
                      }`}
                    >
                      {q.priority === "high" ? "Prioritaire" : "Normale"}
                    </span>
                    <span className="text-muted">{q.addressed_to}</span>
                  </div>
                  <p className="text-sm text-ink">{q.question}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    normal: "px-1.5 py-0.5 rounded text-[10px] bg-success/10 text-success",
    favorable: "px-1.5 py-0.5 rounded text-[10px] bg-success/10 text-success",
    warning: "px-1.5 py-0.5 rounded text-[10px] bg-warning/10 text-warning",
    concerning: "px-1.5 py-0.5 rounded text-[10px] bg-warning/10 text-warning",
    critical: "px-1.5 py-0.5 rounded text-[10px] bg-error/10 text-error",
  };
  return (
    map[status] ?? "px-1.5 py-0.5 rounded text-[10px] bg-surface-strong text-body"
  );
}
