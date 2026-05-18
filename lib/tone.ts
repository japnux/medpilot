/**
 * Tonalité d'affichage de l'app.
 *
 * Calibre la copy et la hiérarchie visuelle selon ce que l'utilisateur peut
 * absorber aujourd'hui. NE MASQUE JAMAIS l'info médicale critique (red flags
 * symptômes, décisions à dates, médicaments actifs, RDV).
 *
 * Pour les prompts Claude, on injecte un bloc de consignes (voir
 * buildToneInstructions). Pour l'UI, on utilise des helpers de substitution
 * (vocabulaire) et des composants conditionnels (accordéons).
 */

import type { TonePreference } from "@/types/database";

export type { TonePreference } from "@/types/database";

// Note : getToneForUser() vit dans lib/tone-server.ts (dépend de Supabase
// server). Ce fichier-ci reste pur et importable côté client.

// ============================================================================
// Métadonnées par mode (label, emoji, description) pour l'UI Settings.
// ============================================================================

export const TONE_META: Record<
  TonePreference,
  { label: string; emoji: string; tagline: string; description: string }
> = {
  medical: {
    label: "Médical",
    emoji: "🩺",
    tagline: "Données brutes, vocabulaire clinique.",
    description:
      "Pour les proches techniques, médecins de famille, ou les patients qui veulent tout savoir. Statistiques, %, taux de récidive et survie sont mis en avant tels quels.",
  },
  balanced: {
    label: "Équilibré",
    emoji: "⚖️",
    tagline: "Reformulé, chiffres contextualisés.",
    description:
      "Pour la plupart des accompagnants. Les chiffres restent visibles mais sont reformulés positivement. Les points favorables apparaissent avant les préoccupants.",
  },
  soft: {
    label: "Apaisé",
    emoji: "🌿",
    tagline: "Langage chaleureux, focus actions.",
    description:
      "Pour le patient lui-même ou les proches en détresse. Les statistiques sont rangées dans un accordéon « voir les détails ». Le vocabulaire évite les termes anxiogènes. Aucune info médicale n'est masquée — vous pouvez basculer en mode Médical à tout moment.",
  },
};

// ============================================================================
// Substitutions de vocabulaire — appliquées côté client à du texte libre.
// Garde-fou : on ne touche JAMAIS au texte d'une posologie, d'un red flag
// symptôme ou d'une dose. Réservé aux contenus narratifs (KB, document
// summary, watch).
// ============================================================================

interface Substitution {
  pattern: RegExp;
  /** Remplacement par mode. Si absent, on garde le texte original. */
  replacements: Partial<Record<TonePreference, string>>;
}

const SUBS: Substitution[] = [
  {
    pattern: /\b(taux de récidive|taux de recidive)\b/gi,
    replacements: {
      balanced: "taux de réapparition",
      soft: "fréquence de réapparition",
    },
  },
  {
    pattern: /\b(récidive|recidive)\b/gi,
    replacements: { soft: "réapparition" },
  },
  {
    pattern: /\b(taux de )?mortalité\b/gi,
    replacements: {
      balanced: "données de survie",
      soft: "données de survie",
    },
  },
  {
    pattern: /\bpronostic défavorable\b/gi,
    replacements: {
      balanced: "situation à surveiller activement",
      soft: "situation à surveiller activement",
    },
  },
  {
    pattern: /\bhaut risque\b/gi,
    replacements: {
      balanced: "à surveiller de près",
      soft: "à surveiller de près",
    },
  },
  {
    pattern: /\beffets indésirables\b/gi,
    replacements: { soft: "effets possibles à surveiller" },
  },
  {
    pattern: /\bcancer agressif\b/gi,
    replacements: {
      balanced: "cancer à évolution rapide",
      soft: "cancer qui demande une surveillance rapprochée",
    },
  },
];

/**
 * Applique les substitutions de vocabulaire à un texte selon le mode.
 * Idempotent : appel répété sans effet supplémentaire.
 */
export function applyToneToText(text: string, tone: TonePreference): string {
  if (!text || tone === "medical") return text;
  let out = text;
  for (const sub of SUBS) {
    const replacement = sub.replacements[tone];
    if (!replacement) continue;
    out = out.replace(sub.pattern, replacement);
  }
  return out;
}

// ============================================================================
// Décisions d'affichage selon le mode.
// ============================================================================

/**
 * Sections de la knowledge base à masquer/replier selon le mode.
 *  - "show"     : affichage normal, ouvert
 *  - "collapse" : accordéon fermé par défaut
 *  - "hide"     : sortable explicitement (via "voir les détails statistiques")
 */
export function knowledgeSectionDisplay(
  sectionKey: string,
  tone: TonePreference,
): "show" | "collapse" {
  // Sections sensibles : stats brutes, pronostic, survie
  const SENSITIVE = new Set(["overview", "staging_classification"]);
  if (!SENSITIVE.has(sectionKey)) return "show";
  if (tone === "soft") return "collapse";
  return "show";
}

/** Couleur de fond pour un encart "préoccupant" selon le mode. */
export function concerningPointsClass(tone: TonePreference): string {
  if (tone === "soft") {
    // En soft : encart sobre, jamais rouge vif
    return "border-amber-200/60 bg-amber-50/50 text-amber-900";
  }
  if (tone === "balanced") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-red-200 bg-red-50 text-red-900";
}

/** Faut-il ouvrir un accordéon "concerning_points" par défaut ? */
export function shouldOpenConcerningByDefault(tone: TonePreference): boolean {
  return tone !== "soft";
}

// ============================================================================
// Bloc d'instructions à injecter dans les prompts Claude. Adapte la copy
// produite par l'IA. Optimisé pour éviter les tokens inutiles : on n'envoie
// le bloc que si tone !== medical.
// ============================================================================

export function buildToneInstructions(tone: TonePreference): string {
  if (tone === "medical") return "";
  if (tone === "balanced") {
    return `

📝 TONALITÉ DEMANDÉE : ÉQUILIBRÉ
Reformule positivement quand possible, sans masquer les chiffres :
- "60% de récidive" → "40% des patients restent en rémission longue"
- "taux de mortalité à 5 ans" → "survie à 5 ans"
- "cancer à haut risque" → "cancer à surveiller de près"
- "pronostic défavorable" → "situation à surveiller activement"
Mets les points favorables AVANT les préoccupants quand tu listes.
Garde les chiffres et les faits — ne déforme pas la réalité médicale.`;
  }
  // soft
  return `

📝 TONALITÉ DEMANDÉE : APAISÉ
L'utilisateur est probablement le patient lui-même ou un proche en détresse.
- Évite les pourcentages bruts ; quand tu dois en donner, reformule au positif (« 7 patients sur 10 sont en vie 5 ans après ») et précise toujours « ces chiffres sont une moyenne ; chaque situation est unique ».
- Vocabulaire : "réapparition" plutôt que "récidive", "données de survie" plutôt que "mortalité", "à surveiller de près" plutôt que "haut risque".
- Ne mentionne JAMAIS les mots "mortalité", "décès", "pronostic défavorable", "fatal", "incurable". S'il faut décrire une situation grave, dis "situation qui demande une surveillance rapprochée" et oriente vers une action concrète.
- Mets EN PREMIER les points favorables, ressources, options de soutien. Les chiffres préoccupants vont en dernier, formulés avec recul.
- Termine quand c'est possible par une note d'action ("en parler au médecin", "ressources disponibles") plutôt que par un constat.

⚠️ Ne masque AUCUN fait médical critique. Les red flags (symptômes urgents, signaux d'alarme, échéances) doivent rester clairement identifiables, juste formulés avec calme.`;
}
