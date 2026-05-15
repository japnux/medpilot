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
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <header className="border-b border-slate-800 px-4 pt-4">
        <h2 className="text-base font-medium text-white">{result.title}</h2>
        {result.document_date && (
          <p className="text-xs text-slate-500 mt-1">
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
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-slate-400 hover:text-white"
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
            <p className="text-lg text-white leading-relaxed">
              {result.summary_family}
            </p>
            {result.action_required && result.action_details && (
              <div className="mt-4 rounded-lg border border-red-700/40 bg-red-900/20 p-3 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{result.action_details}</p>
              </div>
            )}
          </div>
        )}

        {tab === "clinical" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {result.summary_clinical}
            </p>
            {result.key_values.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-2 pr-2">Paramètre</th>
                      <th className="py-2 pr-2">Valeur</th>
                      <th className="py-2 pr-2">Référence</th>
                      <th className="py-2 pr-2">Interprétation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.key_values.map((kv, i) => (
                      <tr key={i} className="border-t border-slate-800">
                        <td className="py-2 pr-2 text-slate-300">{kv.parameter}</td>
                        <td className="py-2 pr-2 text-white font-medium">
                          {kv.value} <span className="text-slate-500">{kv.unit}</span>
                        </td>
                        <td className="py-2 pr-2 text-slate-500">{kv.reference_range}</td>
                        <td className="py-2 pr-2 text-slate-300">
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
                <h4 className="text-sm font-medium text-white mb-2">
                  Examens à planifier
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {result.surveillance_triggered.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>
                        <span className="text-white">{s.exam}</span> · {s.delay} —{" "}
                        <span className="text-slate-500">{s.reason}</span>
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
            <section className="rounded-lg border border-emerald-700/30 bg-emerald-900/10 p-4">
              <h4 className="text-sm font-medium text-emerald-300 flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4" /> Favorables
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-200">
                {result.favorable_points.length === 0 ? (
                  <li className="text-slate-500 italic">Aucun point particulier</li>
                ) : (
                  result.favorable_points.map((p, i) => <li key={i}>• {p}</li>)
                )}
              </ul>
            </section>
            <section className="rounded-lg border border-amber-700/30 bg-amber-900/10 p-4">
              <h4 className="text-sm font-medium text-amber-300 flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4" /> Préoccupants
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-200">
                {result.concerning_points.length === 0 ? (
                  <li className="text-slate-500 italic">Aucun</li>
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
              <h4 className="text-sm font-medium text-white">
                {result.questions_for_team.length} question
                {result.questions_for_team.length > 1 ? "s" : ""} pour l&apos;équipe
              </h4>
              <button
                onClick={copyAllQuestions}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded border border-slate-700 hover:border-slate-600"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copié" : "Copier tout"}
              </button>
            </div>
            <ul className="space-y-2">
              {result.questions_for_team.map((q, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        q.priority === "high"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {q.priority === "high" ? "Prioritaire" : "Normale"}
                    </span>
                    <span className="text-slate-500">{q.addressed_to}</span>
                  </div>
                  <p className="text-sm text-slate-100">{q.question}</p>
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
    normal: "px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300",
    favorable: "px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300",
    warning: "px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300",
    concerning: "px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300",
    critical: "px-1.5 py-0.5 rounded text-[10px] bg-red-500/15 text-red-300",
  };
  return (
    map[status] ?? "px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300"
  );
}
