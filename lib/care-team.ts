/**
 * Helpers pour la gestion du care_team d'un profil cancer.
 *
 * care_team est stocké en jsonb : Array<{ name, specialty?, hospital? }>.
 * On dédoublonne par nom normalisé (case-insensitive, sans accents) et on
 * enrichit les fiches existantes avec les champs nouvellement connus
 * (spécialité ou hôpital absents auparavant).
 */

export interface CareTeamMember {
  name: string;
  specialty?: string;
  hospital?: string;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // retire "dr", "docteur", "pr", "professeur" en préfixe pour comparer
    .replace(/^(dr|docteur|pr|professeur)\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retourne un nouveau care_team avec le médecin upserté.
 * - Si le nom (normalisé) existe déjà : enrichit les champs absents
 *   uniquement, ne remplace pas les valeurs déjà connues.
 * - Sinon : append.
 * Retourne aussi un flag `changed` pour éviter les updates inutiles.
 */
export function upsertCareTeamMember(
  careTeam: CareTeamMember[],
  incoming: CareTeamMember,
): { careTeam: CareTeamMember[]; changed: boolean; added: boolean } {
  const incomingKey = normalizeName(incoming.name);
  if (!incomingKey) return { careTeam, changed: false, added: false };

  const idx = careTeam.findIndex(
    (m) => m.name && normalizeName(m.name) === incomingKey,
  );

  if (idx === -1) {
    const next = [
      ...careTeam,
      {
        name: incoming.name.trim(),
        ...(incoming.specialty ? { specialty: incoming.specialty.trim() } : {}),
        ...(incoming.hospital ? { hospital: incoming.hospital.trim() } : {}),
      },
    ];
    return { careTeam: next, changed: true, added: true };
  }

  const existing = careTeam[idx];
  const merged: CareTeamMember = { ...existing };
  let changed = false;
  if (!existing.specialty && incoming.specialty) {
    merged.specialty = incoming.specialty.trim();
    changed = true;
  }
  if (!existing.hospital && incoming.hospital) {
    merged.hospital = incoming.hospital.trim();
    changed = true;
  }
  if (!changed) return { careTeam, changed: false, added: false };

  const next = [...careTeam];
  next[idx] = merged;
  return { careTeam: next, changed: true, added: false };
}
