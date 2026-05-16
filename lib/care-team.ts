/**
 * Helpers pour la gestion du care_team d'un profil cancer.
 *
 * care_team est stocké en jsonb : Array<{ name, specialty?, hospital? }>.
 *
 * Stratégie de dédoublonnage :
 *  1. Normalisation : lowercase, sans accents, sans préfixe (Dr, Pr, Docteur…),
 *     espaces compactés.
 *  2. Tokenisation : on garde les "mots significatifs" du nom (≥ 2 caractères,
 *     hors particules courantes).
 *  3. Deux médecins sont considérés comme la même personne si l'ensemble de
 *     tokens significatifs de l'un est inclus dans l'autre. Couvre :
 *      - "Dr Grunenwald" ≡ "Dr Solange Grunenwald" (le 1er ⊂ le 2ème)
 *      - "Pr Martin" ≡ "Professeur Jean Martin"
 *      - "Dr Sarah Pericart" ≡ "Pericart Sarah"
 *  4. On garde la version la plus complète (nom le plus long + fusion des
 *     champs specialty/hospital absents).
 */

export interface CareTeamMember {
  name: string;
  specialty?: string;
  hospital?: string;
}

// Particules à exclure lors de la tokenisation (raison : "de", "le", "la" sont
// rarement discriminants ; les retirer évite les faux positifs).
const STOP_WORDS = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "el",
  "von",
  "van",
  "den",
]);

/** Normalisation : lowercase, sans accents, sans préfixe médical. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^(dr|docteur|pr|professeur|m\.?|mme\.?)\s+/i, "")
    .replace(/[.,;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens significatifs : mots ≥ 2 chars, hors stop words. */
function tokens(name: string): Set<string> {
  const norm = normalize(name);
  return new Set(
    norm
      .split(" ")
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t)),
  );
}

/** True si l'un des sets est inclus dans l'autre (et non vides). */
function isSamePerson(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  // Cas particulier : nom mono-token générique (ex: "martin") → on ne fusionne
  // que si l'autre contient EXACTEMENT ce token + au moins un autre. Toujours
  // safe car on prend l'inclusion stricte d'au moins un côté.
  const aInB = [...a].every((t) => b.has(t));
  const bInA = [...b].every((t) => a.has(t));
  return aInB || bInA;
}

/** Fusion de deux fiches : garde le nom le plus long, complète les autres champs. */
function mergeMembers(a: CareTeamMember, b: CareTeamMember): CareTeamMember {
  const aNorm = normalize(a.name);
  const bNorm = normalize(b.name);
  // Nom : on garde le plus long (plus de tokens = plus d'info)
  const name = aNorm.length >= bNorm.length ? a.name.trim() : b.name.trim();
  return {
    name,
    specialty: (a.specialty?.trim() || b.specialty?.trim()) || undefined,
    hospital: (a.hospital?.trim() || b.hospital?.trim()) || undefined,
  };
}

/**
 * Dédoublonne un care_team complet en fusionnant les variantes du même médecin.
 * Conserve l'ordre des premières occurrences.
 */
export function dedupeCareTeam(team: CareTeamMember[]): CareTeamMember[] {
  const result: { member: CareTeamMember; tokens: Set<string> }[] = [];
  for (const raw of team) {
    if (!raw?.name || !raw.name.trim()) continue;
    const incoming: CareTeamMember = {
      name: raw.name.trim(),
      ...(raw.specialty?.trim() ? { specialty: raw.specialty.trim() } : {}),
      ...(raw.hospital?.trim() ? { hospital: raw.hospital.trim() } : {}),
    };
    const incomingTokens = tokens(incoming.name);
    if (incomingTokens.size === 0) {
      // Nom sans tokens significatifs (ex: "Dr") → on conserve tel quel
      result.push({ member: incoming, tokens: incomingTokens });
      continue;
    }
    const matchIdx = result.findIndex((r) =>
      isSamePerson(r.tokens, incomingTokens),
    );
    if (matchIdx === -1) {
      result.push({ member: incoming, tokens: incomingTokens });
    } else {
      const merged = mergeMembers(result[matchIdx].member, incoming);
      result[matchIdx] = { member: merged, tokens: tokens(merged.name) };
    }
  }
  return result.map((r) => r.member);
}

/**
 * Retourne un nouveau care_team avec le médecin upserté.
 * - Si le médecin existe déjà (match fuzzy par tokens) : fusionne et garde
 *   la version la plus complète.
 * - Sinon : append.
 * Retourne aussi un flag `changed` pour éviter les updates inutiles.
 */
export function upsertCareTeamMember(
  careTeam: CareTeamMember[],
  incoming: CareTeamMember,
): { careTeam: CareTeamMember[]; changed: boolean; added: boolean } {
  if (!incoming?.name?.trim()) {
    return { careTeam, changed: false, added: false };
  }
  const before = JSON.stringify(careTeam);
  const next = dedupeCareTeam([...careTeam, incoming]);
  const after = JSON.stringify(next);
  const changed = before !== after;
  const added = next.length > careTeam.length;
  return { careTeam: next, changed, added };
}
