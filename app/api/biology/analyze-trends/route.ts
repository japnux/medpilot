import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callClaudeJson } from "@/lib/anthropic";
import { logApiUsage } from "@/lib/usage-tracker";
import { CANCER_PROFILES, type MarkerDef } from "@/lib/cancer-profiles";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({
  family_id: z.string().uuid(),
  force: z.boolean().optional(),
});

interface TrendInsight {
  /** Synthèse globale en 2-3 phrases (lisible par un proche). */
  overall: string;
  /** Marqueurs en évolution favorable. */
  favorable: string[];
  /** Marqueurs préoccupants ou à surveiller. */
  concerning: string[];
  /** Recommandations actionnables (par exemple "Refaire un bilan dans 1 mois"). */
  recommendations: string[];
  /** Tableau des points saillants par marqueur (le plus parlant). */
  highlights: Array<{
    marker_label: string;
    trend: "up" | "down" | "stable";
    note: string;
  }>;
}

/**
 * POST /api/biology/analyze-trends
 *
 * Génère (ou retourne depuis cache) une analyse IA des tendances biologiques
 * du patient. Cache par famille, invalidé quand un nouveau bilan arrive.
 *
 * Le `data_version` est le `max(recorded_at)::epoch || ":" || count(biology_records)`,
 * ainsi toute nouvelle mesure invalide le cache.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const { family_id, force } = parsed.data;

  // Auth famille
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("family_id", family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // 1. Charger les biology_records de l'année écoulée
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const { data: records } = await supabase
    .from("biology_records")
    .select("marker_name, value, unit, recorded_at, alert_level")
    .eq("family_id", family_id)
    .gte("recorded_at", oneYearAgo.toISOString().slice(0, 10))
    .order("recorded_at", { ascending: false });

  if (!records || records.length === 0) {
    return NextResponse.json({
      ok: true,
      empty: true,
      message: "Aucune donnée biologique à analyser",
    });
  }

  // 2. Calculer le data_version pour le cache
  const latestDate = records[0].recorded_at;
  const dataVersion = `${latestDate}:${records.length}`;

  // 3. Lookup cache (sauf si force=true)
  if (!force) {
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("content, data_version, generated_at")
      .eq("family_id", family_id)
      .eq("cache_type", "biology_trends")
      .maybeSingle();
    if (cached && cached.data_version === dataVersion) {
      await logApiUsage({
        endpoint: "biology/analyze-trends",
        model: "claude-haiku-4-5-20251001",
        input_tokens: 0,
        output_tokens: 0,
        cached: true,
        family_id,
        user_id: user.id,
      });
      return NextResponse.json({
        ok: true,
        cached: true,
        generated_at: cached.generated_at,
        ...(cached.content as object),
      });
    }
  }

  // 4. Préparer le contexte pour Claude : grouper par marqueur, calculer delta
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("cancer_type, cancer_label, custom_markers, diagnosis_date, surgery_date, active_treatments")
    .eq("family_id", family_id)
    .maybeSingle();

  const customMarkers =
    (profile?.custom_markers as unknown as Record<string, MarkerDef>) ?? {};
  const standardMarkers =
    profile?.cancer_type && profile.cancer_type !== "custom"
      ? CANCER_PROFILES[profile.cancer_type]?.markers ?? {}
      : {};
  const allMarkers = { ...customMarkers, ...standardMarkers };

  // Grouper par marker_name : liste de (date, valeur) triée desc
  const byMarker: Record<
    string,
    Array<{ date: string; value: number; unit: string; alert: string | null }>
  > = {};
  for (const r of records) {
    if (!byMarker[r.marker_name]) byMarker[r.marker_name] = [];
    byMarker[r.marker_name].push({
      date: r.recorded_at,
      value: r.value,
      unit: r.unit,
      alert: r.alert_level,
    });
  }

  // Sérialiser pour le prompt
  const markerSerial = Object.entries(byMarker)
    .map(([key, vals]) => {
      const def = allMarkers[key];
      const label = def?.label ?? key;
      const range = def
        ? formatRange(def)
        : "pas de plage de référence";
      const series = vals
        .map((v) => `${v.date}: ${v.value} ${v.unit}${v.alert ? ` [${v.alert}]` : ""}`)
        .join(" | ");
      return `- ${label} (${range}) → ${series}`;
    })
    .join("\n");

  // Calculer la chronologie des bilans
  const recordDates = Array.from(new Set(records.map((r) => r.recorded_at))).sort();
  const earliestRecord = recordDates[0];
  const latestRecord = recordDates[recordDates.length - 1];
  const surgeryDate = profile?.surgery_date as string | null;

  // Y a-t-il au moins un bilan APRÈS la chirurgie ?
  const hasPostSurgery = surgeryDate
    ? recordDates.some((d) => d >= surgeryDate)
    : false;
  const allBeforeSurgery = surgeryDate
    ? recordDates.every((d) => d < surgeryDate)
    : false;

  const timelineNote = surgeryDate
    ? `\n\n⏱️ CHRONOLOGIE PATIENT
- Date chirurgie : ${surgeryDate}
- Bilan le plus ancien dans les données : ${earliestRecord}
- Bilan le plus récent dans les données : ${latestRecord}
- ${hasPostSurgery ? "Au moins un bilan EST post-chirurgical." : "TOUS les bilans listés sont ANTÉRIEURS à la chirurgie."}`
    : `\n\n⏱️ Pas de date de chirurgie renseignée.`;

  const treatmentsList =
    Array.isArray(profile?.active_treatments) &&
    (profile!.active_treatments as Array<{ name?: string }>).length > 0
      ? (profile!.active_treatments as Array<{ name?: string }>)
          .map((t) => t.name)
          .filter(Boolean)
          .join(", ")
      : null;

  const system = `Tu es un assistant médical pour un accompagnant familial d'un patient atteint de ${profile?.cancer_label ?? "cancer"}.${timelineNote}

Analyse les tendances des marqueurs biologiques ci-dessous. Sois prudent mais clair, comme un confrère qui prépare une synthèse pour un proche non-médecin.

⚠️ RÈGLES TEMPORELLES STRICTES ⚠️
1. Tu DOIS situer chaque mesure par rapport à la chronologie patient (avant/après chirurgie).
2. ${allBeforeSurgery ? "TOUS les bilans listés sont AVANT la chirurgie. Tu n'as AUCUN bilan post-chirurgical disponible. Ne parle JAMAIS de récupération post-opératoire, de réponse au traitement adjuvant, ou d'effets de médicaments adjuvants. Tu peux uniquement décrire un état PRÉ-OPÉRATOIRE." : "Distingue clairement les bilans pré-chirurgicaux des bilans post-chirurgicaux."}
3. Si plusieurs bilans à des dates différentes existent pour un marqueur : calcule la variation entre eux en précisant la durée écoulée (ex : "ALAT stable sur 17 jours").
4. Si une seule mesure existe : signale la valeur ponctuelle sans extrapoler de tendance.
5. ${treatmentsList ? `Traitements actuels du patient : ${treatmentsList}. Ces traitements n'existent QUE depuis la chirurgie (${surgeryDate ?? "date inconnue"}). Tu ne dois JAMAIS attribuer un effet de ces médicaments à une mesure datée AVANT la chirurgie.` : "Pas de traitement renseigné."}
6. Ne mentionne un traitement médicamenteux que si la date du bilan est ≥ date de chirurgie ET que le traitement est explicitement listé. Sinon, ne l'évoque PAS.
7. Pas de prescription, pas de diagnostic. Suggère des questions à poser au médecin.

Réponds UNIQUEMENT en JSON :
{
  "overall": "synthèse en 2-3 phrases factuelles (avec mention explicite du contexte temporel : pré-op / post-op / mixte)",
  "favorable": ["marqueurs en évolution favorable, formulés simplement"],
  "concerning": ["marqueurs préoccupants ou à surveiller"],
  "recommendations": ["actions à envisager (questions au médecin, examens à planifier)"],
  "highlights": [
    {"marker_label": "nom du marqueur", "trend": "up|down|stable", "note": "1 phrase explicative avec mention de la durée si plusieurs mesures"}
  ]
}`;

  const user_message = `Marqueurs biologiques du patient (dernières mesures, plus récentes en premier) :

${markerSerial}

Génère l'analyse en JSON.`;

  // 5. Appel Claude (Haiku — analyse rapide)
  const t0 = Date.now();
  try {
    const result = await callClaudeJson<TrendInsight>({
      model: "claude-haiku-4-5-20251001",
      system,
      user: user_message,
      max_tokens: 2048,
    });
    await logApiUsage({
      endpoint: "biology/analyze-trends",
      model: "claude-haiku-4-5-20251001",
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      family_id,
      user_id: user.id,
      duration_ms: Date.now() - t0,
    });

    // 6. Stocker en cache
    await supabase
      .from("ai_cache")
      .upsert(
        {
          family_id,
          cache_type: "biology_trends",
          data_version: dataVersion,
          content: JSON.parse(JSON.stringify(result.json)),
          model: "claude-haiku-4-5-20251001",
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
        },
        { onConflict: "family_id,cache_type" },
      );

    return NextResponse.json({
      ok: true,
      cached: false,
      ...result.json,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Claude";
    await logApiUsage({
      endpoint: "biology/analyze-trends",
      model: "claude-haiku-4-5-20251001",
      input_tokens: 0,
      output_tokens: 0,
      family_id,
      user_id: user.id,
      success: false,
      error_message: msg,
      duration_ms: Date.now() - t0,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function formatRange(m: MarkerDef): string {
  if (m.target_min != null && m.target_max != null) {
    return `cible ${m.target_min}–${m.target_max} ${m.unit}`;
  }
  if (m.target_max != null) return `≤ ${m.target_max} ${m.unit}`;
  if (m.target_min != null) return `≥ ${m.target_min} ${m.unit}`;
  return "pas de plage";
}
