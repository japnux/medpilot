"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { ConsultationPrepResult } from "@/lib/prompts";
import { today as todayIso } from "@/lib/dates";
import { Loader2, Sparkles, X } from "lucide-react";
import type { ConsultationType } from "@/types/database";

const CONSULT_TYPES: { value: ConsultationType; label: string }[] = [
  { value: "oncologie", label: "Oncologie" },
  { value: "endocrinologie", label: "Endocrinologie" },
  { value: "chirurgie", label: "Chirurgie" },
  { value: "rcp", label: "RCP" },
  { value: "genetique", label: "Génétique" },
  { value: "radiologie", label: "Radiologie" },
  { value: "soins_support", label: "Soins de support" },
  { value: "autre", label: "Autre" },
];

interface CareTeamMember {
  name?: string;
  specialty?: string;
  hospital?: string;
}

interface Props {
  familyId: string;
  careTeam: CareTeamMember[];
  onClose: () => void;
}

/**
 * Modal "Ajouter une consultation" : permet de saisir les infos du RDV
 * et de générer une prep IA en un seul flow. À l'enregistrement, navigue
 * vers la page de détail. UX cohérente avec les autres modals de l'app
 * (Décisions, Médicaments, etc.).
 */
export default function AddConsultationModal({
  familyId,
  careTeam,
  onClose,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<ConsultationType>("oncologie");
  const [doctor, setDoctor] = useState("");
  const [hospital, setHospital] = useState("");
  const [openPoints, setOpenPoints] = useState("");
  const [treatmentContext, setTreatmentContext] = useState("");
  const [knownDoctors, setKnownDoctors] =
    useState<CareTeamMember[]>(careTeam);

  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addToCareTeam() {
    const trimmed = doctor.trim();
    if (!trimmed) return;
    if (knownDoctors.some((d) => d.name === trimmed)) return;
    const newMember: CareTeamMember = {
      name: trimmed,
      hospital: hospital.trim() || undefined,
      specialty: type,
    };
    const next = [...knownDoctors, newMember];
    setKnownDoctors(next);
    try {
      const supabase = createClient();
      await supabase
        .from("cancer_profiles")
        .update({ care_team: JSON.parse(JSON.stringify(next)) })
        .eq("family_id", familyId);
    } catch (e) {
      console.warn("Ajout care_team échoué", e);
    }
  }

  /**
   * Génère la prep + persiste la consultation en BDD + redirige vers la
   * page détail. Garde un seul bouton final pour simplifier l'UX :
   * l'utilisateur n'a pas à valider 2 fois.
   */
  async function prepareAndSave() {
    setPreparing(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/prepare-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          consultation_type: type,
          consultation_date: date,
          doctor_name: doctor || undefined,
          hospital: hospital || undefined,
          open_points: openPoints,
          treatment_context: treatmentContext,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur Claude");
      const prep = j.json as ConsultationPrepResult;

      setPreparing(false);
      setSaving(true);
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
        title: `Consultation ${type}${doctor ? ` · ${doctor}` : ""}`,
        summary: prep.consultation_summary,
        linked_consultation_id: c.id,
      });
      router.push(`/consultation/${c.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPreparing(false);
      setSaving(false);
    }
  }

  /**
   * Création sans prep IA (cas RDV passé qu'on veut juste enregistrer).
   * Le user pourra cliquer « Re-générer la prep » sur la page détail
   * plus tard si besoin.
   */
  async function saveWithoutPrep() {
    setSaving(true);
    setError(null);
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
          status: "upcoming",
        })
        .select("id")
        .single();
      if (e1) throw e1;
      await supabase.from("timeline_events").insert({
        family_id: familyId,
        event_type: "consultation",
        event_date: date,
        title: `Consultation ${type}${doctor ? ` · ${doctor}` : ""}`,
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

  const busy = preparing || saving;
  const doctorIsKnown = knownDoctors.some(
    (d) => d.name?.trim() === doctor.trim(),
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
        onClick={!busy ? onClose : undefined}
      >
        <div
          className="bg-canvas rounded-xl border border-hairline shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 p-5 border-b border-hairline">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">
                Nouvelle consultation
              </p>
              <h3 className="text-base font-medium text-ink">
                Ajouter un rendez-vous
              </h3>
              <p className="text-xs text-muted mt-1">
                Claude prépare des questions ciblées basées sur le profil,
                les derniers documents, la biologie, les symptômes, les
                médicaments et les décisions en attente.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="shrink-0 w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-surface-card flex items-center justify-center disabled:opacity-50"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm border border-hairline rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ConsultationType)}
                  className="w-full text-sm border border-hairline rounded-md px-3 py-2 bg-canvas"
                >
                  {CONSULT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-ink">Médecin</label>
                {doctor.trim() && !doctorIsKnown && (
                  <button
                    type="button"
                    onClick={addToCareTeam}
                    className="text-[11px] text-purple-600 hover:underline"
                  >
                    + Ajouter à l&apos;équipe
                  </button>
                )}
              </div>
              <input
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                onBlur={(e) => {
                  const match = knownDoctors.find(
                    (d) => d.name === e.target.value,
                  );
                  if (match?.hospital && !hospital) setHospital(match.hospital);
                }}
                list="add-consult-doctors"
                placeholder="Choisir ou saisir (ex : Dr Grunenwald)"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
              <datalist id="add-consult-doctors">
                {knownDoctors.map((d, i) => (
                  <option
                    key={i}
                    value={d.name ?? ""}
                    label={[d.specialty, d.hospital]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Hôpital / centre
              </label>
              <input
                type="text"
                value={hospital}
                onChange={(e) => setHospital(e.target.value)}
                placeholder="CHU Toulouse"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Points en suspens à aborder (optionnel)
              </label>
              <textarea
                value={openPoints}
                onChange={(e) => setOpenPoints(e.target.value)}
                rows={2}
                placeholder="Ex : Inclusion ADIUVO-2, statut MGMT, ajustement hydrocortisone"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">
                Contexte traitement (optionnel)
              </label>
              <input
                type="text"
                value={treatmentContext}
                onChange={(e) => setTreatmentContext(e.target.value)}
                placeholder="Ex : Sous mitotane depuis 2 sem, asthénie en hausse"
                className="w-full text-sm border border-hairline rounded-md px-3 py-2"
              />
            </div>

            {error && (
              <p className="text-xs text-error rounded-md border border-error/30 bg-error/5 p-2">
                {error}
              </p>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 p-4 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-xs px-3 py-2 rounded-md border border-hairline-strong text-body hover:text-ink disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveWithoutPrep}
              disabled={busy}
              className="text-xs px-3 py-2 rounded-md border border-hairline-strong text-body hover:text-ink disabled:opacity-50"
            >
              {saving && !preparing ? "Enregistrement…" : "Enregistrer seul"}
            </button>
            <button
              type="button"
              onClick={prepareAndSave}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-ink text-canvas hover:bg-ink/90 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Préparer avec Claude
            </button>
          </footer>
        </div>
      </div>

      {(preparing || saving) && (
        <div
          className="fixed inset-0 z-[60] bg-canvas/85 backdrop-blur-sm flex items-center justify-center cursor-wait"
          role="alert"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-canvas border border-hairline shadow-lg px-6 py-5 max-w-xs text-center">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-ink">
                {preparing
                  ? "Génération de la préparation…"
                  : "Enregistrement…"}
              </p>
              <p className="text-xs text-muted mt-1">
                {preparing
                  ? "Claude reprend tout le contexte (symptômes, médocs, décisions, veille, KB)."
                  : "Tu seras redirigé vers la fiche consultation."}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
