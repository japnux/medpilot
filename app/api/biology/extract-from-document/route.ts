import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  extractMeasurements,
  type ExtractedMeasurement,
} from "@/lib/biology-extract";
import type { MarkerDef } from "@/lib/cancer-profiles";

const Schema = z.object({
  document_id: z.string().uuid(),
});

/**
 * POST /api/biology/extract-from-document
 *
 * Lit un medical_document analysé, parcourt analysis_summary.key_values,
 * extrait les valeurs numériques et :
 *  1. Crée des biology_records (recorded_at = document_date) avec source_document_id
 *  2. Ajoute les marqueurs inconnus au custom_markers du profil cancer
 *     (pour qu'ils apparaissent sur le dashboard)
 *  3. N'écrase pas les enregistrements existants (skip si déjà inséré pour ce
 *     marker et ce document)
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
  const { document_id } = parsed.data;

  // 1. Charger le document + vérifier accès
  const { data: doc } = await supabase
    .from("medical_documents")
    .select("id, family_id, document_date, document_type, analysis_summary")
    .eq("id", document_id)
    .maybeSingle();
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Restriction : on n'extrait du dashboard biologique QUE depuis des bilans
  // biologiques (sang/urine). Les anapath/courriers contiennent des scores
  // discrets (Weiss, Ki-67, taille tumorale) qui ne sont pas des biomarqueurs
  // de suivi régulier.
  if (doc.document_type !== "biologie") {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      skipped_reason: `document_type=${doc.document_type} (extraction réservée à biologie)`,
    });
  }

  // RLS vérifie déjà l'appartenance, mais double-check pour défense en profondeur
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("family_id", doc.family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // 2. Extraire les measurements
  const summary = doc.analysis_summary as {
    key_values?: Array<{
      parameter?: string;
      value?: string | number;
      unit?: string;
      reference_range?: string;
      status?: string;
    }>;
  } | null;
  const keyValues = summary?.key_values ?? [];
  if (keyValues.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: "Pas de valeurs" });
  }

  // 3. Charger le profil pour fusionner les custom_markers
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("id, custom_markers")
    .eq("family_id", doc.family_id)
    .maybeSingle();

  const existingCustom: Record<string, MarkerDef> =
    (profile?.custom_markers as unknown as Record<string, MarkerDef>) ?? {};
  const colorOffset = Object.keys(existingCustom).length;
  const measurements: ExtractedMeasurement[] = extractMeasurements(keyValues, colorOffset);

  if (measurements.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      message: "Aucune valeur numérique extractible",
    });
  }

  // 4. Mettre à jour custom_markers (ajout uniquement, pas d'écrasement)
  const mergedCustom: Record<string, MarkerDef> = { ...existingCustom };
  let newMarkersAdded = 0;
  for (const m of measurements) {
    if (!mergedCustom[m.marker_name]) {
      mergedCustom[m.marker_name] = m.marker_def;
      newMarkersAdded++;
    }
  }
  if (profile && newMarkersAdded > 0) {
    await supabase
      .from("cancer_profiles")
      .update({ custom_markers: JSON.parse(JSON.stringify(mergedCustom)) })
      .eq("id", profile.id);
  }

  // 5. Vérifier les biology_records déjà créés pour ce doc (idempotence)
  const { data: existing } = await supabase
    .from("biology_records")
    .select("marker_name")
    .eq("source_document_id", document_id);
  const existingNames = new Set((existing ?? []).map((r) => r.marker_name));

  const rowsToInsert = measurements
    .filter((m) => !existingNames.has(m.marker_name))
    .map((m) => ({
      family_id: doc.family_id,
      recorded_at: doc.document_date ?? new Date().toISOString().slice(0, 10),
      marker_name: m.marker_name,
      value: m.value,
      unit: m.unit,
      out_of_range: m.status !== "normal",
      alert_level: m.status,
      source_document_id: document_id,
    }));

  if (rowsToInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      message: "Déjà extrait précédemment",
    });
  }

  const { error: insErr } = await supabase
    .from("biology_records")
    .insert(rowsToInsert);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted: rowsToInsert.length,
    new_markers: newMarkersAdded,
  });
}
