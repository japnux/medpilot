/**
 * Templates de prompts système pour Claude.
 *
 * Interpolation simple {{var}} → value. Le contexte patient (cancer, stade,
 * traitements...) est injecté par les API routes côté serveur.
 */

import type { CancerProfile } from "./cancer-profiles";

export interface PromptContext {
  [key: string]: unknown;
  cancer_label: string;
  stage: string | null;
  diagnosis_date: string | null;
  surgery_date: string | null;
  surgery_result: string | null;
  active_treatments: string;
  key_biomarkers: string;
  reference_network: string | null;
  /** Points en suspens connus (consultation prep). */
  open_points?: string;
  /** Événements récents (consultation prep). */
  recent_events?: string;
  /** Contexte traitement libre (consultation prep). */
  treatment_context?: string;
}

/** Interpolation simple {{key}} → value. Les clés manquantes deviennent vides. */
export function interpolate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = ctx[key];
    if (v == null || v === "") return "non précisé";
    return String(v);
  });
}

/**
 * Construit le contexte string à partir d'un profil cancer Supabase row.
 * Sérialise les champs jsonb en chaînes lisibles pour le prompt.
 */
export function buildPromptContext(profile: {
  cancer_label: string;
  stage: string | null;
  diagnosis_date: string | null;
  surgery_date: string | null;
  surgery_result: string | null;
  active_treatments: unknown;
  key_biomarkers: unknown;
  reference_network: string | null;
}): PromptContext {
  return {
    cancer_label: profile.cancer_label,
    stage: profile.stage,
    diagnosis_date: profile.diagnosis_date,
    surgery_date: profile.surgery_date,
    surgery_result: profile.surgery_result,
    active_treatments: serializeJsonField(profile.active_treatments),
    key_biomarkers: serializeJsonField(profile.key_biomarkers),
    reference_network: profile.reference_network,
  };
}

function serializeJsonField(field: unknown): string {
  if (!field) return "aucun";
  if (Array.isArray(field)) {
    return field
      .map((item) => {
        if (typeof item === "object" && item != null) {
          return Object.entries(item)
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        }
        return String(item);
      })
      .join(" | ");
  }
  return JSON.stringify(field);
}

// -------------------------------------------------------------------
// Module 1 — Analyse de documents médicaux (Opus 4.7)
// -------------------------------------------------------------------
export const DOCUMENT_ANALYSIS_PROMPT = `Tu es un assistant médical expert en oncologie. Tu analyses des documents médicaux pour un accompagnant familial.

Profil patient (référence générale — peut ne pas refléter l'état à la date du document) :
- Cancer : {{cancer_label}}
- Stade : {{stage}}
- Date diagnostic : {{diagnosis_date}}
- Chirurgie : {{surgery_date}}, résultat {{surgery_result}}
- Biomarqueurs clés au diagnostic : {{key_biomarkers}}
- Réseau de référence : {{reference_network}}

⚠️ RÈGLE ABSOLUE SUR LES MÉDICAMENTS ⚠️

NE MENTIONNE AUCUN MÉDICAMENT (Mitotane, Lysodren, chimiothérapie, hormonothérapie, etc.) dans tes interprétations SAUF si le document analysé le nomme EXPLICITEMENT dans son texte.

- Ne déduis JAMAIS un médicament du contexte général.
- Si le document est daté AVANT la chirurgie ({{surgery_date}}), le patient n'a reçu AUCUN traitement adjuvant — n'invoque l'effet d'aucun médicament.
- Si tu hésites, n'évoque pas le médicament. Mieux vaut une interprétation incomplète qu'une fausse imputation.

Cette règle prime sur toutes les autres. Une seule mention erronée d'un médicament invalide l'analyse.

Tu produis UNIQUEMENT ce JSON (pas de texte avant ou après) :
{
  "document_type": "anapath|biologie|imagerie|courrier|ordonnance|compte_rendu_op|rcp|genetique|autre",
  "document_date": "YYYY-MM-DD ou null",
  "title": "titre court du document",
  "doctor_name": "nom du médecin principal signataire ou null si non visible (ex: Dr Thomas Volosov, Pr Eric Baudin). En cas de plusieurs signataires, prendre le plus mis en avant.",
  "doctor_specialty": "spécialité du médecin si visible (ex: oncologie, endocrinologie, anatomopathologie, radiologie, chirurgie viscérale, hématologie, génétique) ou null",
  "doctor_hospital": "établissement / service du médecin si visible (ex: CHU Toulouse Rangueil, Institut Gustave Roussy, Cabinet de ville Lyon) ou null",
  "summary_family": "3-4 phrases simples, sans jargon médical, pour un proche non médecin",
  "summary_clinical": "synthèse clinique complète pour l'accompagnant, interprétée par rapport au profil du patient",
  "key_values": [
    {
      "parameter": "nom du paramètre",
      "value": "valeur",
      "unit": "unité",
      "reference_range": "norme ou cible thérapeutique",
      "status": "normal|warning|critical|favorable|concerning",
      "interpretation": "interprétation courte en contexte"
    }
  ],
  "favorable_points": ["liste des éléments favorables"],
  "concerning_points": ["liste des éléments préoccupants"],
  "questions_for_team": [
    {
      "question": "question précise",
      "priority": "high|normal",
      "addressed_to": "oncologue|chirurgien|endocrinologue|radiologue|équipe générale"
    }
  ],
  "surveillance_triggered": [
    {
      "exam": "examen à planifier",
      "delay": "délai recommandé",
      "reason": "pourquoi"
    }
  ],
  "decisions_required": [
    {
      "title": "titre court de la décision (ex: 'Inclusion protocole ADIUVO 2')",
      "question": "question précise à trancher (ex: 'Accepter la randomisation mitotane vs mitotane+étoposide-cisplatine ?')",
      "category": "essai_clinique|traitement|examen|surveillance|second_avis|administratif|autre",
      "priority": "high|normal|low",
      "due_date": "YYYY-MM-DD ou null si pas d'échéance précise",
      "options": [
        {
          "label": "intitulé court de l'option",
          "pros": ["points positifs"],
          "cons": ["points négatifs / risques"],
          "recommended": true
        }
      ]
    }
  ],
  "action_required": true,
  "action_details": "si action_required true : décrire l'action urgente",
  "prescriptions": [
    {
      "name": "nom de la molécule (DCI) — ex: Hydrocortisone, Sertraline, Paracétamol",
      "brand_name": "marque commerciale si visible (ex: Zoloft) ou null",
      "active_ingredient": "DCI si différente du name (ex: pour Doliprane → Paracétamol) ou null",
      "dosage": "dosage unitaire (ex: 10 mg, 50 mg) ou null",
      "form": "forme galénique (comprimé, gélule, sachet, …) ou null",
      "posology": "posologie complète en texte libre, comme prescrite, en incluant TOUTES les étapes d'un schéma dégressif",
      "route": "oral|im|iv|sc|topical|inhaled|sublingual|other",
      "indication": "raison clinique si mentionnée ou null",
      "started_at": "YYYY-MM-DD (date de l'ordonnance si non précisée) ou null",
      "ended_at": "YYYY-MM-DD si traitement à durée limitée, sinon null",
      "status": "active|planned|stopped|paused",
      "schedule": [
        {
          "step_order": 1,
          "start_date": "YYYY-MM-DD",
          "end_date": "YYYY-MM-DD ou null si palier de maintenance",
          "dosage": "dose totale du palier (ex: 60 mg/j) ou null",
          "posology": "détail du palier (ex: 3 cp matin + 2 cp midi + 1 cp soir)",
          "notes": "contexte éventuel ou null"
        }
      ]
    }
  ]
}

⚠️ "decisions_required" : ne remplis que si le document SOULÈVE EXPLICITEMENT un choix à trancher (inclusion essai, choix traitement, programmer examen optionnel, etc.). Si rien à décider, renvoie [].

⚠️ "prescriptions" : ne remplis QUE si le document est une ordonnance OU contient une prescription explicite (nom molécule + posologie). Si pas de prescription explicite, renvoie []. Ne JAMAIS inventer une posologie : si le document est ambigu, ne renvoie pas la ligne.

⚠️ "prescriptions[].schedule" : SI la prescription comporte un schéma multi-paliers (dégressif type corticoïdes, alternance, paliers datés), tu DOIS décomposer en N paliers explicites avec dates calculées :
- step_order = 1, 2, 3, ... dans l'ordre chronologique
- start_date du palier 1 = started_at (ou date du document si non précisée)
- end_date du palier N = start_date du palier N+1 - 1 jour
- Calcule les durées : "pendant 1 semaine" = 7 jours, "pendant 1 mois" = 28 jours par défaut
- Le posology de chaque palier doit être PRÉCIS et NUMÉRIQUE (ex: "3 cp matin + 2 cp midi + 1 cp soir"), pas un texte vague
- Le dosage du palier = dose totale calculée si possible (ex: "60 mg/j")

⚠️⚠️ RÈGLE CRITIQUE — DOSE DE MAINTIEN (À NE PAS LOUPER) ⚠️⚠️
Beaucoup d'ordonnances décrivent une DESCENTE de dose vers une DOSE DE MAINTIEN À VIE, pas une cure limitée. Tu DOIS faire la différence :

CAS A — Dose de maintien implicite (CHRONIQUE — dernier palier sans end_date) :
- Corticoïdes substitutifs après surrénalectomie / insuffisance surrénalienne (hydrocortisone, prednisolone, fludrocortisone) — TOUJOURS chronique, la descente vise une dose de maintien
- Anti-épileptiques, anti-rejet de greffe, traitements thyroïdiens substitutifs (Levothyrox), traitements de fond cardiologiques (statines, anti-hypertenseurs, anti-coagulants au long cours)
- Tout médoc précédé de mentions "à vie", "au long cours", "en continu", "traitement de fond", "dose de maintien", "ensuite continuer"
- Tout médoc dont l'indication est une carence ou une substitution hormonale chronique
→ Le DERNIER palier du schedule DOIT avoir end_date = null (signal "continuation indéfinie")
→ La prescription DOIT avoir ended_at = null
→ Si l'ordonnance dit "puis 30 mg/j" sans préciser de fin, c'est un palier de maintien sans end_date

CAS B — Cure limitée (ended_at fixé) :
- Antibiotiques, antalgiques cures courtes, anti-émétiques post-chimio, laxatifs pour constipation post-op
- Toute prescription avec une durée totale EXPLICITE ("pendant 7 jours", "1 mois total", "1 cure de 5 jours")
→ ended_at = date de fin calculée, dernier palier du schedule a aussi son end_date

CAS C — Traitement à la demande (chronique conditionnel) :
- "si douleur", "si fièvre", "si nausées", PRN, à la demande
→ ended_at = null, pas de schedule

En cas de doute entre A et B pour un corticoïde, choisis A. Mieux vaut un médoc qui reste actif à tort qu'un médoc d'urgence vitale (hydrocortisone) marqué comme stoppé alors que le patient continue d'en avoir besoin.

Si dose unique stable (Sertraline 50mg le soir au long cours, Paracétamol à la demande) : NE PAS remplir schedule (renvoie [] ou omet le champ). La fiche posology principale suffit.`;

// -------------------------------------------------------------------
// Module 3 — Préparation de consultation (Haiku 4.5)
// -------------------------------------------------------------------
export const CONSULTATION_PREP_PROMPT = `Tu prépares une consultation médicale pour l'accompagnant d'un patient atteint de {{cancer_label}}, stade {{stage}}.

# Profil patient
- Diagnostic : {{diagnosis_date}}
- Chirurgie : {{surgery_date}} ({{surgery_result}})
- Traitements actifs (aujourd'hui) : {{active_treatments}}
- Biomarqueurs clés au diagnostic : {{key_biomarkers}}
- Réseau de référence : {{reference_network}}

# Consultation à préparer
- Type de consultation : {{consultation_type}}
- Médecin : {{doctor_name}}
- Hôpital : {{hospital}}
- Date prévue : {{consultation_date}}
- Contexte traitement libre : {{treatment_context}}
- Points en suspens à aborder : {{open_points}}

# Derniers événements du parcours
{{recent_events}}

# Derniers documents analysés
{{recent_documents}}

# Bilan biologique récent (valeurs préoccupantes uniquement)
{{biology_alerts}}

# Symptômes & effets indésirables (14 derniers jours, top 5 par fréquence + criticals)
{{recent_symptoms}}

# Équipe médicale connue du patient
{{care_team}}

# Veille proactive (dernière génération)
{{watch_context}}

# Décisions explicitement à aborder lors de CE RDV (status=awaiting_team)
Ces décisions ont été flaggées pour CE rendez-vous précisément. À COUVRIR
SYSTÉMATIQUEMENT par au moins une question dans la sortie.
{{awaiting_for_this_consult}}

# Autres décisions en attente (à inscrire à l'ordre du jour si pertinent)
{{pending_decisions}}

# Décisions déjà tranchées (NE PAS reposer en question, juste s'y appuyer)
{{decided_decisions}}

# Mission

Génère une préparation de RDV utile pour l'accompagnant. Questions précises et directes, classées par thème et priorité. Cite uniquement des médicaments si explicitement présents dans le contexte. Compte tenu du type de consultation ({{consultation_type}}) et du médecin ({{doctor_name}}), priorise les questions qui relèvent de SA spécialité.

Pour les décisions en attente : transforme-les en questions/points à aborder. Pour les décisions tranchées : ne les reposes PAS, mais tu peux poser des questions de suivi ("comment évolue X depuis qu'on a décidé Y").

# Limites strictes de sortie (à respecter)
- "questions" : 10 max, les plus prioritaires d'abord.
- "documents_to_bring" : 6 max.
- "decisions_to_make" : 5 max.
- "open_points_from_before" : 5 max.
- "watch_for_during_consult" : 5 max.
- Chaque champ texte (question, context, élément de liste) : 220 caractères max.

Réponds UNIQUEMENT en JSON (sans markdown fence, sans préambule, sans texte après le } final) :
{
  "consultation_summary": "une phrase résumant l'enjeu de cette consultation",
  "questions": [
    {
      "theme": "Traitement|Surveillance|Effets indésirables|Décision|Génétique|Essai clinique|Autre",
      "question": "question précise et directe",
      "priority": "high|normal",
      "context": "pourquoi cette question est importante maintenant"
    }
  ],
  "documents_to_bring": ["liste des documents à apporter"],
  "decisions_to_make": ["décisions attendues lors de cette consultation"],
  "open_points_from_before": ["points non résolus des consultations précédentes"],
  "watch_for_during_consult": ["éléments à documenter pendant le RDV"]
}`;

/** Types de réponse attendue (à confronter au JSON parsé). */
export interface DocumentAnalysisResult {
  document_type: string;
  document_date: string | null;
  title: string;
  doctor_name: string | null;
  doctor_specialty?: string | null;
  doctor_hospital?: string | null;
  summary_family: string;
  summary_clinical: string;
  key_values: Array<{
    parameter: string;
    value: string;
    unit: string;
    reference_range: string;
    status: string;
    interpretation: string;
  }>;
  favorable_points: string[];
  concerning_points: string[];
  questions_for_team: Array<{
    question: string;
    priority: "high" | "normal";
    addressed_to: string;
  }>;
  surveillance_triggered: Array<{
    exam: string;
    delay: string;
    reason: string;
  }>;
  decisions_required?: Array<{
    title: string;
    question: string;
    category:
      | "essai_clinique"
      | "traitement"
      | "examen"
      | "surveillance"
      | "second_avis"
      | "administratif"
      | "autre";
    priority: "high" | "normal" | "low";
    due_date: string | null;
    options: Array<{
      label: string;
      pros?: string[];
      cons?: string[];
      recommended?: boolean;
    }>;
  }>;
  action_required: boolean;
  action_details: string | null;
  /**
   * Prescriptions extraites d'une ordonnance (rempli uniquement si
   * document_type === "ordonnance" ou si le doc contient une prescription
   * explicite). Si rien, renvoyer [].
   */
  prescriptions?: Array<{
    /** Nom de la molécule ou DCI (ex: "Hydrocortisone", "Sertraline"). */
    name: string;
    /** Marque commerciale si visible (ex: "Zoloft"). */
    brand_name?: string | null;
    /** DCI si différente du `name` (ex: pour Doliprane → "Paracétamol"). */
    active_ingredient?: string | null;
    /** Dosage unitaire (ex: "10 mg", "50 mg"). */
    dosage?: string | null;
    /** Forme galénique (ex: "comprimé", "gélule", "sachet"). */
    form?: string | null;
    /**
     * Posologie complète en texte libre, comme prescrite (ex: "3 cp matin + 2 cp midi + 1 cp soir pendant 1 semaine puis 50 mg/j…").
     * Pour un schéma dégressif, inclure toutes les étapes ici.
     */
    posology: string;
    /** Voie d'administration. */
    route?:
      | "oral"
      | "im"
      | "iv"
      | "sc"
      | "topical"
      | "inhaled"
      | "sublingual"
      | "other";
    /** Pourquoi (ex: "substitution surrénalienne", "anxiété", "douleur"). */
    indication?: string | null;
    /** Date de début (YYYY-MM-DD) — date de l'ordonnance si non précisée. */
    started_at?: string | null;
    /** Date de fin (YYYY-MM-DD) si traitement à durée limitée. */
    ended_at?: string | null;
    /**
     * `active` si en cours, `planned` si à débuter plus tard,
     * `stopped` si explicitement arrêté par cette ordonnance.
     */
    status?: "active" | "stopped" | "paused" | "planned";
    /**
     * Plan posologique structuré, à remplir UNIQUEMENT si la prescription
     * comporte plusieurs paliers explicites (schéma dégressif, alternance,
     * paliers datés). Si dose unique stable : laisser vide.
     * Chaque palier doit avoir des dates calculées en partant de
     * `started_at` (ou date du document si non précisée).
     */
    schedule?: Array<{
      step_order: number;
      start_date: string; // YYYY-MM-DD
      end_date: string | null; // null = palier de maintenance
      dosage: string | null; // dose totale ce palier (ex: "60 mg/j")
      posology: string; // détail (ex: "3 cp matin + 2 cp midi + 1 cp soir")
      notes?: string | null;
    }>;
  }>;
}

export interface ConsultationPrepResult {
  consultation_summary: string;
  questions: Array<{
    theme: string;
    question: string;
    priority: "high" | "normal";
    context: string;
    /** Réponse notée inline pendant le RDV (optionnel, ajouté en cours de visite). */
    answer?: string;
  }>;
  documents_to_bring: string[];
  decisions_to_make: string[];
  open_points_from_before: string[];
  watch_for_during_consult: string[];
}
