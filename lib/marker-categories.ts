/**
 * Catégorisation des marqueurs biologiques pour l'affichage par onglets.
 * Inspiré du pattern Health-dashboard.
 *
 * Le `marker_name` est le slug (snake_case) produit par lib/biology-extract.ts
 * ou défini dans lib/cancer-profiles.ts. Les regex permettent de matcher des
 * variantes (ex: "alat" et "alanine_aminotransferase" → foie).
 */

export type MarkerCategoryKey =
  | "foie"
  | "lipides"
  | "metabolique"
  | "hormones"
  | "vitamines"
  | "thyroide"
  | "inflammation"
  | "hematologie"
  | "serologies"
  | "reins"
  | "tumoraux"
  | "autres";

export interface MarkerCategory {
  key: MarkerCategoryKey;
  label: string;
  emoji: string;
}

/** Ordre d'affichage des catégories. */
export const MARKER_CATEGORIES: MarkerCategory[] = [
  { key: "foie", label: "Foie", emoji: "🫁" },
  { key: "lipides", label: "Lipides", emoji: "🩸" },
  { key: "metabolique", label: "Métabolique", emoji: "🧪" },
  { key: "hormones", label: "Hormones", emoji: "🧴" },
  { key: "vitamines", label: "Vitamines & Minéraux", emoji: "🌈" },
  { key: "thyroide", label: "Thyroïde", emoji: "🦋" },
  { key: "inflammation", label: "Inflammation", emoji: "🛡️" },
  { key: "hematologie", label: "Hématologie", emoji: "🧬" },
  { key: "serologies", label: "Sérologies", emoji: "🦠" },
  { key: "reins", label: "Reins", emoji: "💧" },
  { key: "tumoraux", label: "Marqueurs tumoraux", emoji: "🔬" },
  { key: "autres", label: "Autres", emoji: "📌" },
];

/** Mapping (regex sur le slug normalisé) → catégorie. */
const RULES: Array<{ pattern: RegExp; category: MarkerCategoryKey }> = [
  // Foie
  { pattern: /^alat$|^asat$|alat_|asat_|gamma_?gt|gamma_glutamyl|^ggt$|alkaline_phosphat|phosphatase_alcaline|^alp$|bilirubin|^albumine$|^albumin$|fib_?4|ratio_ast_alt|ast_alt/, category: "foie" },
  // Lipides
  { pattern: /cholester|^ldl$|^hdl$|^trigly|trigly/, category: "lipides" },
  // Métabolique
  { pattern: /glycemie|glucose|hba1c|hemoglobine_glyqu|fructosamine|microalbumin/, category: "metabolique" },
  // Hormones
  { pattern: /cortisol|^acth$|dhea|mitotane|oestradiol|estradiol|prolactin|testostero|progesterone|^fsh$|^lh$|sdhea|stradiol/, category: "hormones" },
  // Vitamines / Minéraux / Électrolytes
  { pattern: /vitamin|vit_?d$|vit_?b12|^b12$|folate|^fer$|ferritine|^calcium$|^magnesium$|sodium|potassium|natremie|kaliemie|^zinc$|^cuivre$/, category: "vitamines" },
  // Thyroïde
  { pattern: /^tsh$|^t3$|^t4$|t4_libre|t3_libre|thyroglobulin|tpo|anti_tpo/, category: "thyroide" },
  // Inflammation
  { pattern: /^crp$|c_reactive|^vs$|vitesse_sedimentation|procalcitonin|fibrinogen|tryptase|enzyme_de_conversion|^eca$/, category: "inflammation" },
  // Hématologie
  { pattern: /hemoglobin|leucocyte|plaquette|^vgm$|^tcmh$|^ccmh$|hematocr|reticulocyte|gammaglobulin|immunofixation|ratio_chaines|chaines_legeres/, category: "hematologie" },
  // Sérologies / Immunité virale
  { pattern: /^ac_|antibod|igm|igg|^cmv|^ebv|hepatit|hbs|hcv|^vih$|hiv|^bcg|toxoplasm|rubeol/, category: "serologies" },
  // Reins
  { pattern: /creatinin|^uree$|^dfg$|gfr|microalbumin/, category: "reins" },
  // Marqueurs tumoraux
  { pattern: /^psa$|^ca_?\d+_?\d*$|^cea$|^afp$|^hcg$|^beta_?hcg$/, category: "tumoraux" },
];

export function categorizeMarker(markerName: string): MarkerCategoryKey {
  const slug = markerName.toLowerCase();
  for (const { pattern, category } of RULES) {
    if (pattern.test(slug)) return category;
  }
  return "autres";
}

/** Retourne les catégories qui ont au moins 1 marker dans la liste. */
export function getActiveCategories(markerNames: string[]): MarkerCategory[] {
  const found = new Set<MarkerCategoryKey>();
  for (const n of markerNames) found.add(categorizeMarker(n));
  return MARKER_CATEGORIES.filter((c) => found.has(c.key));
}
