"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { CANCER_PROFILES } from "@/lib/cancer-profiles";
import Step1Family from "@/components/onboarding/Step1Family";
import Step2Patient from "@/components/onboarding/Step2Patient";
import Step3Situation from "@/components/onboarding/Step3Situation";
import Step4Invite from "@/components/onboarding/Step4Invite";

export interface OnboardingState {
  familyName: string;
  creatorRole: "patient" | "accompagnant";
  creatorDisplayName: string;
  patientFirstName: string;
  patientBirthDate: string;
  cancerType: string;
  customCancerLabel: string;
  customMarkers: Array<{ key: string; label: string; unit: string }>;
  diagnosisDate: string;
  stage: string;
  hadSurgery: boolean;
  surgeryDate: string;
  surgeryResult: string;
  treatments: string[];
  careTeam: Array<{ name: string; specialty: string; hospital: string }>;
}

const emptyState: OnboardingState = {
  familyName: "",
  creatorRole: "accompagnant",
  creatorDisplayName: "",
  patientFirstName: "",
  patientBirthDate: "",
  cancerType: "corticosurrenalome",
  customCancerLabel: "",
  customMarkers: [],
  diagnosisDate: "",
  stage: "",
  hadSurgery: false,
  surgeryDate: "",
  surgeryResult: "R0",
  treatments: [],
  careTeam: [],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<OnboardingState>) {
    setState((s) => ({ ...s, ...patch }));
  }

  async function finalize() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // 1. Créer la famille (created_by doit être l'user pour passer la policy INSERT)
      const { data: family, error: famErr } = await supabase
        .from("families")
        .insert({
          name: state.familyName,
          created_by: user.id,
          onboarding_completed: false,
        })
        .select("id")
        .single();
      if (famErr) throw famErr;

      // 2. Créer le family_member admin (l'utilisateur actuel)
      const { error: memErr } = await supabase
        .from("family_members")
        .insert({
          family_id: family.id,
          user_id: user.id,
          role: "admin",
          display_name: state.creatorDisplayName || (user.email ?? "Utilisateur"),
        });
      if (memErr) throw memErr;

      // 3. Créer le profil cancer
      const profile = CANCER_PROFILES[state.cancerType];
      const customMarkersObj: Record<string, { label: string; unit: string; color: string }> = {};
      state.customMarkers.forEach((m) => {
        if (m.key) {
          customMarkersObj[m.key] = {
            label: m.label,
            unit: m.unit,
            color: "#6366f1",
          };
        }
      });

      const { error: profErr } = await supabase.from("cancer_profiles").insert({
        family_id: family.id,
        cancer_type: state.cancerType,
        cancer_label:
          state.cancerType === "custom" ? state.customCancerLabel : profile.label,
        patient_first_name: state.patientFirstName || null,
        patient_birth_date: state.patientBirthDate || null,
        diagnosis_date: state.diagnosisDate || null,
        stage: state.stage || null,
        surgery_date: state.hadSurgery ? state.surgeryDate || null : null,
        surgery_result: state.hadSurgery ? state.surgeryResult || null : null,
        active_treatments: state.treatments.map((name) => ({ name })),
        care_team: state.careTeam,
        custom_markers: customMarkersObj,
        reference_network: profile?.reference_network ?? null,
      });
      if (profErr) throw profErr;

      // 4. Si chirurgie : ajouter un événement timeline
      if (state.hadSurgery && state.surgeryDate) {
        await supabase.from("timeline_events").insert({
          family_id: family.id,
          event_type: "surgery",
          event_date: state.surgeryDate,
          title: `Chirurgie — ${state.surgeryResult}`,
          summary: `Résection chirurgicale (${state.surgeryResult})`,
        });
      }

      // 5. Surveillance alerts auto depuis le schedule
      if (profile?.surveillance_schedule?.length) {
        const today = new Date();
        const slots: Array<{
          family_id: string;
          alert_type: string;
          label: string;
          due_date: string;
        }> = [];
        // Génère 12 mois de slots
        for (const item of profile.surveillance_schedule) {
          for (let i = 1; i <= Math.ceil(12 / item.frequency_months); i++) {
            const d = new Date(today);
            d.setMonth(d.getMonth() + i * item.frequency_months);
            slots.push({
              family_id: family.id,
              alert_type: item.alert_type,
              label: item.label,
              due_date: d.toISOString().slice(0, 10),
            });
          }
        }
        if (slots.length) {
          await supabase.from("surveillance_alerts").insert(slots);
        }
      }

      // 6. Marquer onboarding complet
      const { error: updErr } = await supabase
        .from("families")
        .update({ onboarding_completed: true })
        .eq("id", family.id);
      if (updErr) throw updErr;

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      // Supabase PostgrestError n'est pas instanceof Error mais a .message/.details/.hint
      const err = e as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      const msg =
        err?.message ||
        err?.details ||
        (e instanceof Error ? e.message : null) ||
        JSON.stringify(e).slice(0, 300);
      setError(`${msg}${err?.hint ? ` — ${err.hint}` : ""}${err?.code ? ` [${err.code}]` : ""}`);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-8">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex-1">
              <div
                className={`h-1 rounded-full ${
                  step >= n ? "bg-primary" : "bg-surface-strong"
                }`}
              />
              <p
                className={`mt-2 text-xs ${
                  step >= n ? "text-body" : "text-muted-soft"
                }`}
              >
                Étape {n}/4
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-card p-8">
          {step === 1 && (
            <Step1Family state={state} update={update} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2Patient
              state={state}
              update={update}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3Situation
              state={state}
              update={update}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <Step4Invite
              state={state}
              onBack={() => setStep(3)}
              onFinalize={finalize}
              loading={loading}
            />
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-error/30 bg-canvas-soft p-3 text-sm text-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
