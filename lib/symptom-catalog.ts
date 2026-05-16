/**
 * Catalogue de symptômes : effets indésirables connus depuis la KB cancer
 * + symptômes universels. Les chips KB sont affichées en premier dans le
 * QuickLogger pour guider l'utilisateur vers les effets attendus du
 * traitement en cours.
 */

import type { SymptomCategory } from "./symptoms";

export interface CatalogEntry {
  type: string;
  label: string;
  category: SymptomCategory;
  source: "kb" | "common";
  related_medication?: string;
}

const COMMON_SYMPTOMS: CatalogEntry[] = [
  { type: "fatigue", label: "Fatigue / asthénie", category: "general", source: "common" },
  { type: "nausee", label: "Nausées", category: "digestive", source: "common" },
  { type: "vomissement", label: "Vomissements", category: "digestive", source: "common" },
  { type: "diarrhee", label: "Diarrhée", category: "digestive", source: "common" },
  { type: "constipation", label: "Constipation", category: "digestive", source: "common" },
  { type: "douleur_abdo", label: "Douleurs abdominales", category: "digestive", source: "common" },
  { type: "perte_appetit", label: "Perte d'appétit", category: "general", source: "common" },
  { type: "vertige", label: "Vertiges", category: "neurological", source: "common" },
  { type: "mal_de_tete", label: "Maux de tête", category: "neurological", source: "common" },
  { type: "confusion", label: "Confusion / troubles cognitifs", category: "neurological", source: "common" },
  { type: "insomnie", label: "Insomnie", category: "psychological", source: "common" },
  { type: "anxiete", label: "Anxiété", category: "psychological", source: "common" },
  { type: "humeur_basse", label: "Humeur basse", category: "psychological", source: "common" },
  { type: "fievre", label: "Fièvre", category: "general", source: "common" },
  { type: "frissons", label: "Frissons", category: "general", source: "common" },
  { type: "douleur_articulaire", label: "Douleurs articulaires", category: "musculoskeletal", source: "common" },
  { type: "douleur_musculaire", label: "Douleurs musculaires", category: "musculoskeletal", source: "common" },
  { type: "essoufflement", label: "Essoufflement", category: "respiratory", source: "common" },
  { type: "toux", label: "Toux", category: "respiratory", source: "common" },
  { type: "rash", label: "Éruption cutanée", category: "skin", source: "common" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function categoryFromLabel(label: string): SymptomCategory {
  const l = label.toLowerCase();
  if (/(nausee|vomiss|diarrh|constip|abdom|appetit|gastro|hepat|foie)/.test(l)) return "digestive";
  if (/(vertige|confusion|cognit|cephal|mal de t|insomnie|neuro)/.test(l)) return "neurological";
  if (/(tension|cardia|hypotens|hypertens|palpi|infarct)/.test(l)) return "cardiovascular";
  if (/(rash|cutan|prurit|eruption|peau)/.test(l)) return "skin";
  if (/(articul|musculaire|muscu|os)/.test(l)) return "musculoskeletal";
  if (/(toux|essouffl|dyspn|respir)/.test(l)) return "respiratory";
  if (/(anxiete|depress|humeur|moral|psychol)/.test(l)) return "psychological";
  return "general";
}

/**
 * Construit le catalogue à partir de la KB cancer. Les effets KB sont en
 * premier (ils correspondent au traitement en cours), les communs ensuite.
 */
export function buildSymptomCatalog(
  kb: { side_effects_to_monitor?: unknown } | null | undefined,
): CatalogEntry[] {
  const kbEntries: CatalogEntry[] = [];
  const arr = (kb?.side_effects_to_monitor as unknown[]) ?? [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const treatment = typeof obj.treatment === "string" ? obj.treatment : undefined;
    const common = Array.isArray(obj.common_effects) ? (obj.common_effects as string[]) : [];
    const serious = Array.isArray(obj.serious_effects) ? (obj.serious_effects as string[]) : [];
    for (const effect of [...common, ...serious]) {
      if (!effect || typeof effect !== "string") continue;
      kbEntries.push({
        type: slugify(effect),
        label: effect,
        category: categoryFromLabel(effect),
        source: "kb",
        related_medication: treatment,
      });
    }
  }

  // Dédup : on garde la 1ère occurrence (donc KB prioritaire)
  const seen = new Set<string>();
  const merged: CatalogEntry[] = [];
  for (const e of [...kbEntries, ...COMMON_SYMPTOMS]) {
    if (!seen.has(e.type)) {
      seen.add(e.type);
      merged.push(e);
    }
  }
  return merged;
}
