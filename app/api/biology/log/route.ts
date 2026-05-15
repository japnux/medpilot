import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CANCER_PROFILES, type MarkerDef } from "@/lib/cancer-profiles";
import { getMarkerStatus, isOutOfRange } from "@/lib/markers";

const Schema = z.object({
  family_id: z.string().uuid(),
  recorded_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  measurements: z
    .array(
      z.object({
        marker_name: z.string().min(1),
        value: z.number().finite(),
        unit: z.string().min(1),
      }),
    )
    .min(1),
});

/**
 * POST /api/biology/log
 * Insère plusieurs biology_records + un timeline_event résumant le bilan.
 * Calcule le alert_level côté serveur en croisant avec le profil cancer.
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
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { family_id, recorded_at, measurements } = parsed.data;

  // Vérification d'appartenance (RLS ne protégerait qu'à l'insert, on veut tôt)
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("family_id", family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Charger le profil cancer pour calculer alert_level
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("cancer_type, custom_markers")
    .eq("family_id", family_id)
    .maybeSingle();

  const cancerType = profile?.cancer_type ?? "custom";
  const customMarkers =
    (profile?.custom_markers as unknown as Record<string, MarkerDef>) ?? {};
  const standardMarkers =
    cancerType === "custom" ? {} : CANCER_PROFILES[cancerType]?.markers ?? {};
  // Fusion : standards prioritaires pour préserver les seuils thérapeutiques canoniques
  const profileMarkers: Record<string, MarkerDef> = {
    ...customMarkers,
    ...standardMarkers,
  };

  // Construire les rangées à insérer
  const rows = measurements.map((m) => {
    const def = profileMarkers[m.marker_name];
    if (def) {
      const status = getMarkerStatus(m.value, def);
      return {
        family_id,
        recorded_at,
        marker_name: m.marker_name,
        value: m.value,
        unit: m.unit,
        out_of_range: isOutOfRange(m.value, def),
        alert_level: status,
      };
    }
    return {
      family_id,
      recorded_at,
      marker_name: m.marker_name,
      value: m.value,
      unit: m.unit,
      out_of_range: false,
      alert_level: "normal" as const,
    };
  });

  const { error: insErr } = await supabase.from("biology_records").insert(rows);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Ajout d'un événement timeline résumant le bilan
  const hasCritical = rows.some((r) => r.alert_level === "critical");
  const summary = rows
    .map((r) => `${r.marker_name}: ${r.value} ${r.unit}`)
    .join(" · ");

  await supabase.from("timeline_events").insert({
    family_id,
    event_type: "biology",
    event_date: recorded_at,
    title: `Bilan biologique (${rows.length} marqueur${rows.length > 1 ? "s" : ""})`,
    summary,
    is_critical: hasCritical,
    linked_biology_date: recorded_at,
  });

  return NextResponse.json({ ok: true, inserted: rows.length });
}
