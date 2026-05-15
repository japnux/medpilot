"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { CANCER_PROFILE_OPTIONS } from "@/lib/cancer-profiles";
import type { Database } from "@/types/database";
import { UserPlus, Trash2 } from "lucide-react";

type CancerProfile = Database["public"]["Tables"]["cancer_profiles"]["Row"];

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  relation: string | null;
}

interface CareTeamMember {
  name?: string;
  specialty?: string;
  hospital?: string;
}

interface Props {
  familyId: string;
  isAdmin: boolean;
  profile: CancerProfile | null;
  members: Member[];
  currentUserId: string;
  careTeam: CareTeamMember[];
}

type Tab = "profile" | "team" | "members";

export default function SettingsClient({
  familyId,
  isAdmin,
  profile,
  members,
  currentUserId,
  careTeam: initialTeam,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");

  // Profile fields
  const [cancerLabel, setCancerLabel] = useState(profile?.cancer_label ?? "");
  const [patientName, setPatientName] = useState(profile?.patient_first_name ?? "");
  const [stage, setStage] = useState(profile?.stage ?? "");
  const [diagnosisDate, setDiagnosisDate] = useState(profile?.diagnosis_date ?? "");

  // Care team
  const [team, setTeam] = useState<CareTeamMember[]>(initialTeam);

  // Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"patient" | "accompagnant">("accompagnant");
  const [inviteName, setInviteName] = useState("");
  const [inviteRelation, setInviteRelation] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: e } = await supabase
        .from("cancer_profiles")
        .update({
          cancer_label: cancerLabel,
          patient_first_name: patientName || null,
          stage: stage || null,
          diagnosis_date: diagnosisDate || null,
        })
        .eq("family_id", familyId);
      if (e) throw e;
      setStatus("Profil mis à jour");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function saveTeam() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const cleaned = team.filter((t) => t.name?.trim());
      const { error: e } = await supabase
        .from("cancer_profiles")
        .update({ care_team: JSON.parse(JSON.stringify(cleaned)) })
        .eq("family_id", familyId);
      if (e) throw e;
      setStatus("Équipe mise à jour");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite() {
    if (!inviteEmail || !inviteName) {
      setError("Email et prénom requis");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/family/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          email: inviteEmail,
          role: inviteRole,
          display_name: inviteName,
          relation: inviteRelation || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur");
      setStatus(`Invitation envoyée à ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      setInviteRelation("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Retirer ce membre ?")) return;
    const supabase = createClient();
    const { error: e } = await supabase
      .from("family_members")
      .delete()
      .eq("id", memberId);
    if (e) setError(e.message);
    else router.refresh();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Paramètres</h1>

      <nav className="flex gap-1 border-b border-hairline">
        {(["profile", "team", "members"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 ${
              tab === t
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t === "profile" ? "Profil cancer" : t === "team" ? "Équipe médicale" : "Membres famille"}
          </button>
        ))}
      </nav>

      {status && (
        <p className="text-xs text-success">{status}</p>
      )}
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}

      {tab === "profile" && (
        <section className="rounded-xl border border-hairline bg-surface-card p-5 space-y-4">
          {!isAdmin && (
            <p className="text-xs text-warning">
              Seul l&apos;administrateur peut modifier le profil cancer.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-muted">Type de cancer</span>
              <select
                disabled
                value={profile?.cancer_type ?? "custom"}
                className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink opacity-60"
              >
                {CANCER_PROFILE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted">Libellé affiché</span>
              <input
                disabled={!isAdmin}
                value={cancerLabel}
                onChange={(e) => setCancerLabel(e.target.value)}
                className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs space-y-1">
              <span className="text-muted">Prénom patient</span>
              <input
                disabled={!isAdmin}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted">Stade</span>
              <input
                disabled={!isAdmin}
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              />
            </label>
          </div>
          <label className="text-xs space-y-1 block">
            <span className="text-muted">Date diagnostic</span>
            <input
              type="date"
              disabled={!isAdmin}
              value={diagnosisDate ?? ""}
              onChange={(e) => setDiagnosisDate(e.target.value)}
              className="w-full md:w-1/2 h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
            />
          </label>
          {isAdmin && (
            <button
              onClick={saveProfile}
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-sm text-on-primary"
            >
              {saving ? "..." : "Enregistrer"}
            </button>
          )}
        </section>
      )}

      {tab === "team" && (
        <section className="rounded-xl border border-hairline bg-surface-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink">Équipe médicale</h2>
            {isAdmin && (
              <button
                onClick={() =>
                  setTeam([...team, { name: "", specialty: "", hospital: "" }])
                }
                className="text-xs text-ink"
              >
                + Ajouter
              </button>
            )}
          </div>
          {team.length === 0 && (
            <p className="text-xs text-muted italic">Aucun médecin enregistré.</p>
          )}
          {team.map((m, i) => (
            <div key={i} className="grid grid-cols-7 gap-2">
              <input
                placeholder="Nom"
                disabled={!isAdmin}
                value={m.name ?? ""}
                onChange={(e) => {
                  const n = [...team];
                  n[i] = { ...n[i], name: e.target.value };
                  setTeam(n);
                }}
                className="col-span-2 h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              />
              <input
                placeholder="Spécialité"
                disabled={!isAdmin}
                value={m.specialty ?? ""}
                onChange={(e) => {
                  const n = [...team];
                  n[i] = { ...n[i], specialty: e.target.value };
                  setTeam(n);
                }}
                className="col-span-2 h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              />
              <input
                placeholder="Hôpital"
                disabled={!isAdmin}
                value={m.hospital ?? ""}
                onChange={(e) => {
                  const n = [...team];
                  n[i] = { ...n[i], hospital: e.target.value };
                  setTeam(n);
                }}
                className="col-span-2 h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
              />
              {isAdmin && (
                <button
                  onClick={() => setTeam(team.filter((_, idx) => idx !== i))}
                  className="col-span-1 h-9 rounded border border-hairline-strong text-xs text-muted hover:text-error"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {isAdmin && team.length > 0 && (
            <button
              onClick={saveTeam}
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-sm text-on-primary"
            >
              {saving ? "..." : "Enregistrer"}
            </button>
          )}
        </section>
      )}

      {tab === "members" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-hairline bg-surface-card p-5 space-y-2">
            <h2 className="text-sm font-medium text-ink">Membres</h2>
            <ul className="divide-y divide-hairline">
              {members.map((m) => (
                <li key={m.id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-ink">{m.display_name}</p>
                    <p className="text-xs text-muted">
                      {m.role}
                      {m.relation && ` · ${m.relation}`}
                      {m.user_id === currentUserId && " · vous"}
                    </p>
                  </div>
                  {isAdmin && m.user_id !== currentUserId && (
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-muted hover:text-error p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isAdmin && (
            <div className="rounded-xl border border-hairline bg-surface-card p-5 space-y-3">
              <h2 className="text-sm font-medium text-ink flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Inviter un proche
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="email@exemple.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
                />
                <input
                  placeholder="Prénom affiché"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
                />
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "patient" | "accompagnant")
                  }
                  className="h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
                >
                  <option value="accompagnant">Accompagnant</option>
                  <option value="patient">Patient</option>
                </select>
                <input
                  placeholder="Lien (conjoint, fils...)"
                  value={inviteRelation}
                  onChange={(e) => setInviteRelation(e.target.value)}
                  className="h-9 px-2 rounded bg-canvas border border-hairline-strong text-sm text-ink"
                />
              </div>
              <button
                onClick={sendInvite}
                disabled={saving}
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-40 text-sm text-on-primary"
              >
                {saving ? "..." : "Envoyer l'invitation"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
