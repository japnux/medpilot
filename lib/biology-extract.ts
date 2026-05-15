/**
 * Extraction des valeurs biologiques d'un document analysé par Claude.
 *
 * Source : analysis_summary.key_values[] dans medical_documents.
 * Cible : insertion dans biology_records + enrichissement du profil cancer
 *        (custom_markers JSONB) pour que les nouveaux marqueurs apparaissent
 *        sur le dashboard.
 */

import type { MarkerDef } from "./cancer-profiles";

/** Slug d'un nom de paramètre médical : "Gamma GT" → "gamma_gt" */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

/**
 * Parse une valeur Claude (string, virgule décimale FR) en nombre.
 * Retourne null si non numérique (ex : "Absence de protéine monoclonale").
 * Pour "<2" → 2 ; ">11.4" → 11.4 (on garde la valeur seuil sans le signe).
 */
export function parseValue(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = raw
    .trim()
    .replace(/^[<>≤≥]+/, "")
    .replace(",", ".")
    .replace(/[^\d.\-eE]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse une plage de référence Claude.
 * "13,0-18,0" → { target_min: 13, target_max: 18 }
 * "<50" → { target_max: 50 }
 * "≥10" → { target_min: 10 }
 * "Absence" → {}
 */
export function parseRange(raw: string | null | undefined): {
  target_min?: number;
  target_max?: number;
} {
  if (!raw) return {};
  const s = raw.trim().replace(",", ".");

  // Format "<X" ou "≤X"
  const ltMatch = s.match(/^[<≤]\s*([\d.]+)/);
  if (ltMatch) return { target_max: parseFloat(ltMatch[1]) };

  // Format ">X" ou "≥X"
  const gtMatch = s.match(/^[>≥]\s*([\d.]+)/);
  if (gtMatch) return { target_min: parseFloat(gtMatch[1]) };

  // Format "X-Y" ou "X – Y"
  const rangeMatch = s.match(/(-?[\d.]+)\s*[-–]\s*([\d.]+)/);
  if (rangeMatch) {
    return {
      target_min: parseFloat(rangeMatch[1]),
      target_max: parseFloat(rangeMatch[2]),
    };
  }

  return {};
}

/** Palette de couleurs cyclique pour les marqueurs custom (ajoutés depuis docs). */
const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899",
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316",
  "#3b82f6", "#a855f7", "#14b8a6", "#eab308",
];

export function pickColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export interface ExtractedMeasurement {
  marker_name: string;
  marker_label: string;
  value: number;
  unit: string;
  reference_range: string | null;
  status: "normal" | "warning" | "critical";
  marker_def: MarkerDef;
}

/**
 * À partir des key_values bruts retournés par Claude, produit la liste des
 * mesures parsables (valeur numérique présente) avec leurs metadata.
 *
 * Mapping du `status` Claude :
 *  - "normal" / "favorable" → "normal"
 *  - "warning" / "concerning" → "warning"
 *  - "critical" → "critical"
 *  - autre → "normal"
 */
export function extractMeasurements(
  keyValues: Array<{
    parameter?: string;
    value?: string | number;
    unit?: string;
    reference_range?: string;
    status?: string;
  }>,
  startColorIndex = 0,
): ExtractedMeasurement[] {
  const out: ExtractedMeasurement[] = [];

  keyValues.forEach((kv, i) => {
    if (!kv.parameter) return;
    const numeric = parseValue(kv.value ?? null);
    if (numeric == null) return; // skip qualitatif (ex : "Absence de protéine...")

    const { target_min, target_max } = parseRange(kv.reference_range);
    const status = normalizeStatus(kv.status);

    const marker_def: MarkerDef = {
      label: kv.parameter,
      unit: (kv.unit ?? "").trim() || "—",
      target_min: target_min ?? null,
      target_max: target_max ?? null,
      color: pickColor(startColorIndex + i),
    };

    out.push({
      marker_name: slugify(kv.parameter),
      marker_label: kv.parameter,
      value: numeric,
      unit: marker_def.unit,
      reference_range: kv.reference_range ?? null,
      status,
      marker_def,
    });
  });

  return out;
}

function normalizeStatus(s: string | undefined): "normal" | "warning" | "critical" {
  switch ((s ?? "").toLowerCase()) {
    case "normal":
    case "favorable":
      return "normal";
    case "warning":
    case "concerning":
      return "warning";
    case "critical":
      return "critical";
    default:
      return "normal";
  }
}
