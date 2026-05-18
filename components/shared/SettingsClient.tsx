"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { CANCER_PROFILE_OPTIONS } from "@/lib/cancer-profiles";
import type { Database } from "@/types/database";
import { UserPlus, Trash2 } from "lucide-react";
import { dedupeCareTeam, type CareTeamMember as CareTeamMemberShared } from "@/lib/care-team";
import { TONE_META, type TonePreference } from "@/lib/tone";

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
  currentTone: TonePreference;
}

type Tab = "profile" | "team" | "members" | "tone";

export default function SettingsClient({
  familyId,
  isAdmin,
  profile,
  members,
  currentUserId,
  careTeam: initialTeam,
  currentTone,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [tone, setTone] = useState<TonePreference>(currentTone);
  const [toneSaving, setToneSaving] = useState(false);

  async function saveTone(next: TonePreference) {
    setTone(next);
    setToneSaving(true);
    try {
      const res = await fetch("/api/me/tone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone_preference: next }),
      });
      if (!res.ok) throw new Error("Échec mise à jour tonalité");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      // Rollback affichage
      setTone(currentTone);
    } finally {
      setToneSaving(false);
    }
  }

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
      // Dédoublonnage : fusionne automatiquement les variantes du même médecin
      // (ex: "Dr Grunenwald" et "Dr Solange Grunenwald")
      const cleaned = dedupeCareTeam(
        team
          .filter((t) => t.name?.trim())
          .map((t) => ({
            name: t.name!,
            specialty: t.specialty,
            hospital: t.hospital,
          })) as CareTeamMemberShared[],
      );
      const { error: e } = await supabase
        .from("cancer_profiles")
        .update({ care_team: JSON.parse(JSON.stringify(cleaned)) })
        .eq("family_id", familyId);
      if (e) throw e;
      // Reflète localement (au cas où des doublons ont été fusionnés à l'écriture)
      setTeam(cleaned);
      setStatus(
        cleaned.length < team.filter((t) => t.name?.trim()).length
          ? `Équipe mise à jour (${team.filter((t) => t.name?.trim()).length - cleaned.length} doublon(s) fusionné(s))`
          : "Équipe mise à jour",
      );
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

      <nav className="inline-flex flex-wrap bg-canvas-soft border border-hairline rounded-lg p-1 gap-1">
        {(["profile", "team", "members", "tone"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`inline-flex items-center px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === t
                ? "bg-canvas text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {t === "profile"
              ? "Profil cancer"
              : t === "team"
                ? "Équipe médicale"
                : t === "members"
                  ? "Membres famille"
                  : "Tonalité"}
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

      {tab === "tone" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-ink mb-1">
              Tonalité de l&apos;app
            </h2>
            <p className="text-sm text-muted">
              Calibre la présentation de l&apos;information selon ce que vous
              voulez voir. Le contenu médical reste accessible dans tous les
              modes.
            </p>
          </div>

          <div className="space-y-2">
            {(["medical", "balanced", "soft"] as const).map((t) => {
              const meta = TONE_META[t];
              const active = tone === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => saveTone(t)}
                  disabled={toneSaving}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    active
                      ? "border-ink bg-canvas-soft"
                      : "border-hairline bg-canvas hover:bg-canvas-soft"
                  } ${toneSaving ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5" aria-hidden>
                      {meta.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="text-base font-medium text-ink">
                          {meta.label}
                        </h3>
                        <span className="text-xs text-muted">{meta.tagline}</span>
                      </div>
                      <p className="text-sm text-body mt-1">
                        {meta.description}
                      </p>
                    </div>
                    {active && (
                      <span className="text-xs text-ink font-medium shrink-0 mt-0.5">
                        ✓ Actif
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview de copy */}
          <div className="rounded-lg border border-hairline bg-canvas-soft p-4">
            <p className="text-xs uppercase tracking-wider text-muted mb-2 font-medium">
              Exemple — même donnée vue selon le mode actif
            </p>
            <TonePreview tone={tone} />
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted italic border-l-2 border-hairline pl-3">
            Aucune information médicale n&apos;est masquée par le mode Apaisé.
            Les alertes critiques (symptômes urgents, décisions à dates,
            posologies) restent visibles dans tous les modes. Vous pouvez
            changer d&apos;avis à tout moment.
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * Aperçu interactif : montre comment la même information apparaît selon
 * le mode choisi. Sert à expliquer le choix avant qu'il s'applique partout.
 */
function TonePreview({ tone }: { tone: TonePreference }) {
  if (tone === "medical") {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-ink">
          <strong>Survie à 5 ans :</strong> 60 %. Taux de récidive locale : 35 %.
        </p>
        <p className="text-body">
          Cancer à haut risque, pronostic défavorable en cas de Ki-67 &gt; 30 %.
          Effets indésirables du mitotane : nausées, asthénie, troubles
          cognitifs.
        </p>
      </div>
    );
  }
  if (tone === "balanced") {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-ink">
          <strong>Données de survie :</strong> 6 patients sur 10 sont en vie 5
          ans après le diagnostic.
        </p>
        <p className="text-body">
          Cancer à surveiller de près. 65 % des patients restent en rémission
          locale. Le mitotane peut entraîner des effets à surveiller (nausées,
          fatigue, troubles cognitifs).
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      <p className="text-ink">
        Les données récentes montrent que <strong>la majorité des patients</strong>{" "}
        sont en vie 5 ans après le diagnostic.
      </p>
      <p className="text-body">
        Votre situation demande une surveillance rapprochée — c&apos;est
        précisément pour ça que MedPilot vous accompagne. Les effets possibles
        à surveiller du mitotane (fatigue, troubles digestifs) sont à signaler
        à votre équipe si vous les ressentez.
      </p>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Voir les détails statistiques</summary>
        <p className="mt-2">
          Survie à 5 ans : 60 %. Taux de réapparition locale : 35 %. Ces
          chiffres sont une moyenne — chaque situation est unique.
        </p>
      </details>
    </div>
  );
}
