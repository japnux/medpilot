"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { ConsultationPrepResult } from "@/lib/prompts";
import { formatDateFr, today } from "@/lib/dates";
import Link from "next/link";
import { Calendar, MapPin, User, Sparkles } from "lucide-react";

const CONSULT_TYPES = [
  ["oncologie", "Oncologie"],
  ["endocrinologie", "Endocrinologie"],
  ["chirurgie", "Chirurgie"],
  ["rcp", "RCP"],
  ["genetique", "Génétique"],
  ["radiologie", "Radiologie"],
  ["soins_support", "Soins de support"],
  ["autre", "Autre"],
] as const;

type ConsultType = (typeof CONSULT_TYPES)[number][0];

interface Props {
  familyId: string;
  upcoming: Array<{
    id: string;
    consultation_date: string;
    doctor_name: string | null;
    consultation_type: string | null;
    hospital: string | null;
    status: string;
  }>;
}

export default function ConsultationClient({ familyId, upcoming }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(today());
  const [type, setType] = useState<ConsultType>("oncologie");
  const [doctor, setDoctor] = useState("");
  const [hospital, setHospital] = useState("");
  const [openPoints, setOpenPoints] = useState("");
  const [treatmentContext, setTreatmentContext] = useState("");

  const [preparing, setPreparing] = useState(false);
  const [prep, setPrep] = useState<ConsultationPrepResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function prepare() {
    setPreparing(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/prepare-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          consultation_type: type,
          open_points: openPoints,
          treatment_context: treatmentContext,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur");
      setPrep(j.json as ConsultationPrepResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPreparing(false);
    }
  }

  async function save() {
    if (!prep) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: c, error: e1 } = await supabase
        .from("consultations")
        .insert({
          family_id: familyId,
          consultation_date: date,
          consultation_type: type,
          doctor_name: doctor || null,
          hospital: hospital || null,
          prepared_questions: JSON.parse(JSON.stringify(prep)),
          status: "upcoming",
        })
        .select("id")
        .single();
      if (e1) throw e1;
      await supabase.from("timeline_events").insert({
        family_id: familyId,
        event_type: "consultation",
        event_date: date,
        title: `${type}${doctor ? ` — Dr ${doctor}` : ""}`,
        summary: prep.consultation_summary,
        linked_consultation_id: c.id,
      });
      router.push(`/consultation/${c.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Préparer une consultation</h1>
        <p className="text-sm text-muted mt-1">
          Claude Haiku génère des questions adaptées au contexte du patient.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulaire gauche */}
        <div className="lg:col-span-2 rounded-xl border border-hairline bg-surface-card p-5 space-y-4 h-fit">
          <h2 className="text-sm font-medium text-ink">Informations du RDV</h2>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-muted">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ConsultType)}
                className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              >
                {CONSULT_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-xs space-y-1 block">
            <span className="text-muted">Médecin</span>
            <input
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              placeholder="ex : Dr Dupont"
              className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
            />
          </label>

          <label className="text-xs space-y-1 block">
            <span className="text-muted">Hôpital / centre</span>
            <input
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
              className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
            />
          </label>

          <label className="text-xs space-y-1 block">
            <span className="text-muted">Points en suspens (optionnel)</span>
            <textarea
              value={openPoints}
              onChange={(e) => setOpenPoints(e.target.value)}
              rows={3}
              placeholder="ex : résultats de la mitotanémie à interpréter, question sur l'effet secondaire X..."
              className="w-full px-2 py-1.5 rounded bg-canvas border border-hairline-strong text-sm text-ink"
            />
          </label>

          <label className="text-xs space-y-1 block">
            <span className="text-muted">Contexte traitement (optionnel)</span>
            <input
              value={treatmentContext}
              onChange={(e) => setTreatmentContext(e.target.value)}
              placeholder="ex : 8 mois sous mitotane"
              className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
            />
          </label>

          <button
            onClick={prepare}
            disabled={preparing}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-sm font-medium text-on-primary"
          >
            <Sparkles className="w-4 h-4" />
            {preparing ? "Génération..." : "Préparer avec Claude"}
          </button>

          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        {/* Résultat droite */}
        <div className="lg:col-span-3 space-y-4">
          {prep ? (
            <>
              <div className="rounded-xl border border-hairline bg-surface-card p-5 space-y-4">
                <p className="text-sm text-body-strong italic">{prep.consultation_summary}</p>

                <section>
                  <h3 className="text-sm font-medium text-ink mb-2">
                    Questions ({prep.questions.length})
                  </h3>
                  <ul className="space-y-2">
                    {prep.questions.map((q, i) => (
                      <li
                        key={i}
                        className="rounded border border-hairline bg-canvas-soft p-3 space-y-1"
                      >
                        <div className="flex gap-2 text-[10px] uppercase">
                          <span className="px-1.5 py-0.5 rounded bg-surface-strong text-body">
                            {q.theme}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              q.priority === "high"
                                ? "bg-error/10 text-error"
                                : "bg-surface-strong text-body"
                            }`}
                          >
                            {q.priority === "high" ? "Prioritaire" : "Normale"}
                          </span>
                        </div>
                        <p className="text-sm text-ink">{q.question}</p>
                        <p className="text-xs text-muted italic">{q.context}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                {prep.documents_to_bring.length > 0 && (
                  <Section title="Documents à apporter" items={prep.documents_to_bring} />
                )}
                {prep.decisions_to_make.length > 0 && (
                  <Section title="Décisions attendues" items={prep.decisions_to_make} />
                )}
                {prep.watch_for_during_consult.length > 0 && (
                  <Section title="À documenter pendant le RDV" items={prep.watch_for_during_consult} />
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={saving}
                  className="h-10 px-5 rounded-lg bg-success hover:bg-success disabled:opacity-40 text-sm font-medium text-on-primary"
                >
                  {saving ? "Enregistrement..." : "Enregistrer la consultation"}
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-hairline bg-canvas-soft p-8 text-center">
              <Sparkles className="w-8 h-8 text-muted-soft mx-auto mb-3" />
              <p className="text-sm text-muted">
                Remplissez les infos à gauche puis cliquez sur «&nbsp;Préparer&nbsp;».
              </p>
            </div>
          )}

          {/* Liste des consultations à venir */}
          {upcoming.length > 0 && (
            <section className="rounded-xl border border-hairline bg-surface-card p-5 space-y-2">
              <h3 className="text-sm font-medium text-ink">Consultations à venir</h3>
              <ul className="divide-y divide-hairline">
                {upcoming.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/consultation/${c.id}`}
                      className="flex items-center gap-3 py-2.5 hover:bg-canvas-soft rounded px-2"
                    >
                      <Calendar className="w-4 h-4 text-muted" />
                      <span className="text-sm text-ink">
                        {formatDateFr(c.consultation_date)}
                      </span>
                      <span className="text-xs text-muted ml-auto">
                        {c.consultation_type} {c.doctor_name && `· ${c.doctor_name}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h4 className="text-sm font-medium text-ink mb-1.5">{title}</h4>
      <ul className="space-y-1 text-xs text-body">
        {items.map((it, i) => (
          <li key={i}>• {it}</li>
        ))}
      </ul>
    </section>
  );
}
