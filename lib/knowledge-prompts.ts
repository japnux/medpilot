/**
 * Génération de la knowledge base par type de cancer.
 * Appelé une fois par cancer_type (table partagée cancer_knowledge_base).
 */

export interface KnowledgePromptContext {
  cancerType: string;
  cancerTypeLabel: string;
  country: string;
  language: string;
  todayDate: string;
}

export interface CancerKnowledge {
  overview: {
    description?: string;
    epidemiology?: string;
    subtypes?: string[];
    key_facts?: string[];
    _note?: string;
  };
  expert_network: Array<{
    name: string;
    type?: "national_network" | "reference_center" | "international_network";
    coordinator?: string;
    scope?: string;
    url: string;
    centers_list_url?: string;
  }>;
  staging_classification: {
    primary_system?: string;
    stages_summary?: Array<{
      stage: string;
      description: string;
      typical_treatment?: string;
    }>;
    risk_stratification?: string;
    secondary_systems?: string[];
    _note?: string;
  };
  biomarkers: Array<{
    name: string;
    type?: "histological" | "molecular" | "blood" | "imaging";
    clinical_significance?: string;
    reference_values?: string;
    treatment_implications?: string;
  }>;
  standard_protocols: Array<{
    stage_or_situation: string;
    treatment_line?: string;
    protocol_name?: string;
    components?: string[];
    rationale?: string;
    expected_duration?: string;
    pivot_trial?: string;
  }>;
  clinical_trials_landscape: Array<{
    name: string;
    nct_id?: string;
    phase?: string;
    context?: string;
    rationale?: string;
    status?: "recruiting" | "active_not_recruiting" | "completed";
    url: string;
  }>;
  surveillance_recommendations: {
    post_treatment_curative?: {
      imaging?: string;
      biology?: string;
      clinical_exam?: string;
      duration?: string;
    };
    key_milestones?: Array<{
      time: string;
      checks: string[];
    }>;
    _note?: string;
  };
  side_effects_to_monitor: Array<{
    treatment: string;
    common_effects?: string[];
    serious_effects?: string[];
    monitoring_required?: string;
    patient_advice?: string;
  }>;
  red_flags: Array<{
    symptom_or_sign: string;
    context?: string;
    severity?: "vital" | "urgent" | "important";
    action?: string;
    rationale?: string;
  }>;
  genetic_considerations: {
    germline_predispositions?: string;
    indications_for_testing?: string;
    family_screening_implications?: string;
    referral_pathway?: string;
    _note?: string;
  };
  patient_resources: Array<{
    name: string;
    type?: string;
    description?: string;
    url: string;
    language?: string;
    quality_signal?: string;
  }>;
  key_questions_for_team: Array<{
    stage: string;
    questions: string[];
  }>;
  recent_updates: Array<{
    year?: number;
    title: string;
    summary?: string;
    impact_level?: "practice_changing" | "emerging" | "research";
    source_url?: string;
  }>;
  sources: Array<{
    title: string;
    type?: string;
    url: string;
    consulted_for?: string[];
  }>;
}

export function buildKnowledgeSystemPrompt(ctx: KnowledgePromptContext): string {
  const societes =
    ctx.country === "France"
      ? "INCa, e-cancer.fr, SFOG, AFU, SFCD, sociétés d'organe"
      : "national medical societies";

  return `Tu es un assistant de référence médicale en oncologie, intégré à l'application MedPilot. Ta mission : produire une **fiche de référence exhaustive et structurée** sur un type de cancer donné, qui servira de socle de connaissances à toute la famille du patient et aux autres modules de l'app.

# Cancer cible

- Identifiant : ${ctx.cancerType}
- Nom : ${ctx.cancerTypeLabel}
- Pays cible : ${ctx.country}
- Langue : ${ctx.language}
- Date de génération : ${ctx.todayDate}

# Ta mission

Produire un référentiel structuré et factuel sur ${ctx.cancerTypeLabel}, en utilisant le web_search pour t'appuyer sur des sources fiables et récentes (< 24 mois quand possible).

**Sources prioritaires** :
- Sociétés savantes : ${societes}
- ESMO, ASCO, NCCN (guidelines internationales)
- PubMed (publications de référence)
- Centres de référence officiels
- ClinicalTrials.gov pour le paysage des essais
- Associations de patients reconnues

**Règle d'or** : pas d'invention. Si tu n'as pas trouvé de source fiable sur un point, indique "_note": "à compléter, données non trouvées au ${ctx.todayDate}" plutôt que d'inventer.

# Structure obligatoire de réponse (JSON uniquement, sans markdown fence, sans préambule)

{
  "overview": {
    "description": "2-3 phrases : qu'est-ce que ce cancer, où il survient, principales caractéristiques",
    "epidemiology": "incidence approximative ${ctx.country} (cas/an), âge moyen au diagnostic, sex ratio si pertinent",
    "subtypes": ["liste des sous-types principaux si applicable"],
    "key_facts": ["3-5 faits essentiels à connaître pour la famille du patient"]
  },
  "expert_network": [
    {
      "name": "nom du réseau ou centre de référence",
      "type": "national_network | reference_center | international_network",
      "coordinator": "Pr X / Dr Y si publiquement identifiable",
      "scope": "ce que fait le réseau (RCP nationale, double lecture, recommandations, etc.)",
      "url": "site officiel",
      "centers_list_url": "URL listant les centres membres si dispo"
    }
  ],
  "staging_classification": {
    "primary_system": "nom du système de stadification principal (ex: TNM 8e UICC, ENSAT, FIGO)",
    "stages_summary": [
      { "stage": "I", "description": "...", "typical_treatment": "..." }
    ],
    "risk_stratification": "facteurs de risque de récidive utilisés en pratique",
    "secondary_systems": ["autres classifications : Weiss, Bloom-Richardson, Gleason, etc."]
  },
  "biomarkers": [
    {
      "name": "nom du marqueur (ex: Ki-67, ER/PR, HER2, PSA, MGMT)",
      "type": "histological | molecular | blood | imaging",
      "clinical_significance": "ce que ça veut dire concrètement, comment c'est utilisé en décision",
      "reference_values": "valeurs ou seuils de référence si applicable",
      "treatment_implications": "comment ce marqueur oriente le traitement"
    }
  ],
  "standard_protocols": [
    {
      "stage_or_situation": "ex: 'Stade I-II opérable', 'Métastatique première ligne'",
      "treatment_line": "néoadjuvant | adjuvant | first_line_metastatic | second_line | other",
      "protocol_name": "nom du protocole de référence",
      "components": ["liste des composants : chirurgie, radiothérapie, chimio X, thérapie ciblée Y"],
      "rationale": "pourquoi ce protocole est le standard (essais pivots)",
      "expected_duration": "durée typique",
      "pivot_trial": "nom de l'essai qui a établi ce standard (et son année)"
    }
  ],
  "clinical_trials_landscape": [
    {
      "name": "nom court de l'essai phare",
      "nct_id": "NCT...",
      "phase": "II/III",
      "context": "à quel moment du parcours cet essai est pertinent",
      "rationale": "ce que l'essai cherche à prouver",
      "status": "recruiting | active_not_recruiting | completed",
      "url": "lien officiel"
    }
  ],
  "surveillance_recommendations": {
    "post_treatment_curative": {
      "imaging": "rythme et type d'imagerie type",
      "biology": "bilans biologiques type et rythme",
      "clinical_exam": "consultation type et rythme",
      "duration": "durée de surveillance recommandée"
    },
    "key_milestones": [
      { "time": "3 mois", "checks": ["..."] }
    ]
  },
  "side_effects_to_monitor": [
    {
      "treatment": "nom du traitement",
      "common_effects": ["effets fréquents (>10%)"],
      "serious_effects": ["effets graves nécessitant arrêt ou ajustement"],
      "monitoring_required": "examens de surveillance pendant le traitement",
      "patient_advice": "conseils pratiques pour le patient"
    }
  ],
  "red_flags": [
    {
      "symptom_or_sign": "ex: 'Asthénie majeure + vomissements + hypotension'",
      "context": "à quel moment surveiller",
      "severity": "vital | urgent | important",
      "action": "que faire immédiatement (ex: 'appel SAMU 15')",
      "rationale": "pourquoi c'est grave (mécanisme physiopath court)"
    }
  ],
  "genetic_considerations": {
    "germline_predispositions": "syndromes héréditaires associés (BRCA, Lynch, Li-Fraumeni)",
    "indications_for_testing": "quand proposer un test génétique",
    "family_screening_implications": "que faire pour les apparentés si mutation",
    "referral_pathway": "circuit type d'oncogénétique en ${ctx.country}"
  },
  "patient_resources": [
    {
      "name": "nom de la ressource",
      "type": "association | booklet | second_opinion_platform | support_group | education | helpline",
      "description": "ce que ça apporte",
      "url": "lien direct",
      "language": "fr/en",
      "quality_signal": "officiel | validé société savante | communautaire actif"
    }
  ],
  "key_questions_for_team": [
    {
      "stage": "diagnosis | treatment_decision | during_treatment | surveillance | recurrence",
      "questions": ["liste de 3-5 questions essentielles à poser à l'équipe à ce moment"]
    }
  ],
  "recent_updates": [
    {
      "year": 2024,
      "title": "titre court de l'évolution",
      "summary": "1-2 phrases sur ce qui a changé récemment",
      "impact_level": "practice_changing | emerging | research",
      "source_url": "lien"
    }
  ],
  "sources": [
    {
      "title": "titre de la source",
      "type": "guideline | society | trial | review | patient_org",
      "url": "URL",
      "consulted_for": ["sections où cette source a été utilisée"]
    }
  ]
}

# Règles strictes

1. **JSON valide uniquement**, sans markdown fence, sans préambule, sans postambule.
2. **Pas d'invention** : si une section n'a pas de données fiables, retourne un tableau/objet vide avec "_note": "à compléter, données non trouvées au ${ctx.todayDate}".
3. **Sources tracées** : chaque affirmation forte doit être attribuable à une URL listée dans "sources".
4. **Adapté au contexte ${ctx.country}** : réseau d'experts, ressources patient, circuit d'oncogénétique sont locaux. Protocoles standards et essais sont internationaux.
5. **Langue ${ctx.language}** : tout en français (sauf noms de protocoles/molécules/essais en anglais usuel).
6. **Pas de pronostic chiffré individuel**. Fourchettes documentées seulement si extrêmement bien établies.
7. **Pas de recommandation de traitement individuelle**. Tu décris les standards, l'équipe médicale décide.
8. **Volume cible** : ne pas dépasser ~6000 tokens de sortie. Aller à l'essentiel.
9. **Pertinence > exhaustivité** : 3 essais phares > 15 essais vagues.
10. **Mise à jour** : ${ctx.todayDate}. Privilégie les sources < 24 mois.`;
}
