import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CANCER_PROFILES, type MarkerDef } from "@/lib/cancer-profiles";
import MarkersByCategory from "@/components/dashboard/MarkersByCategory";
import BiologyTrendsCard from "@/components/dashboard/BiologyTrendsCard";
import BilansHistory from "@/components/dashboard/BilansHistory";
import AlertBanner from "@/components/shared/AlertBanner";

export const dynamic = "force-dynamic";

/**
 * Module 2 — Biologie.
 * - Analyse IA des tendances (cachée par famille, invalidée à chaque nouveau bilan)
 * - Bannière critique si une valeur est en alert_level=critical
 * - Grid de MarkerCard avec sparklines + delta vs mesure précédente
 *
 * Les valeurs proviennent maintenant exclusivement des bilans biologiques
 * analysés via /analyzer (extraction auto vers biology_records).
 */
export default async function BiologiePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  const familyId = membership.family_id;

  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("cancer_type, custom_markers")
    .eq("family_id", familyId)
    .maybeSingle();

  const cancerType = profile?.cancer_type ?? "custom";
  const customMarkers = (profile?.custom_markers as unknown as Record<string, MarkerDef>) ?? {};
  const standardMarkers =
    cancerType === "custom" ? {} : CANCER_PROFILES[cancerType]?.markers ?? {};
  // Fusion : custom_markers (issus des analyses) en base + markers standards
  // du profil cancer prioritaires pour préserver les seuils thérapeutiques.
  const markers: Record<string, MarkerDef> = {
    ...customMarkers,
    ...standardMarkers,
  };

  // Charger l'historique biologique (1 an glissant)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: records } = await supabase
    .from("biology_records")
    .select("marker_name, value, unit, recorded_at, alert_level, source_document_id")
    .eq("family_id", familyId)
    .gte("recorded_at", oneYearAgo.toISOString().slice(0, 10))
    .order("recorded_at", { ascending: false });

  // Charger les documents sources liés (pour afficher titre + médecin par bilan)
  const docIds = Array.from(
    new Set((records ?? []).map((r) => r.source_document_id).filter(Boolean)),
  ) as string[];
  const { data: docs } = docIds.length
    ? await supabase
        .from("medical_documents")
        .select("id, title, doctor_name")
        .in("id", docIds)
    : { data: [] };
  const docById = new Map((docs ?? []).map((d) => [d.id, d]));

  // Grouper par marker_name (records ordonné desc)
  const byMarker: Record<
    string,
    Array<{ recorded_at: string; value: number; alert_level: string | null }>
  > = {};
  for (const r of records ?? []) {
    if (!byMarker[r.marker_name]) byMarker[r.marker_name] = [];
    byMarker[r.marker_name].push({
      recorded_at: r.recorded_at,
      value: r.value,
      alert_level: r.alert_level,
    });
  }

  // Grouper par date pour la section "Historique des bilans"
  const byDate = new Map<
    string,
    { records: typeof records; source_doc_id: string | null }
  >();
  for (const r of records ?? []) {
    const date = r.recorded_at;
    if (!byDate.has(date)) {
      byDate.set(date, { records: [], source_doc_id: r.source_document_id });
    }
    byDate.get(date)!.records!.push(r);
  }
  const bilans = Array.from(byDate.entries())
    .map(([date, { records: list, source_doc_id }]) => ({
      date,
      records:
        list?.map((r) => ({
          marker_name: r.marker_name,
          value: r.value,
          unit: r.unit,
          alert_level: r.alert_level,
          source_document_id: r.source_document_id,
        })) ?? [],
      source_document: source_doc_id
        ? (docById.get(source_doc_id) as
            | { id: string; title: string; doctor_name: string | null }
            | undefined) ?? null
        : null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Détecter les alertes critiques sur la dernière valeur de chaque marqueur
  const criticals: string[] = [];
  for (const [key, list] of Object.entries(byMarker)) {
    const last = list[0];
    if (last?.alert_level === "critical") {
      criticals.push(markers[key]?.label ?? key);
    }
  }

  // N'afficher que les marqueurs qui ont au moins une mesure (le reste est bruit)
  const markersWithData = Object.entries(markers).filter(
    ([key]) => (byMarker[key]?.length ?? 0) > 0,
  );
  const hasAnyData = markersWithData.length > 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Biologie</h1>
        <p className="text-sm text-muted mt-1">
          Marqueurs biologiques extraits des bilans analysés dans Analyser.
        </p>
      </header>

      {criticals.length > 0 && (
        <AlertBanner
          title={`Alerte critique sur ${criticals.length} marqueur${criticals.length > 1 ? "s" : ""}`}
          message={`Valeurs hors zone d'alerte : ${criticals.join(", ")}. Contactez l'équipe médicale.`}
        />
      )}

      {hasAnyData && <BiologyTrendsCard familyId={familyId} />}

      {!hasAnyData ? (
        <div className="card-feature text-center">
          <p className="text-sm text-muted">
            Aucun bilan biologique pour le moment.
          </p>
          <p className="text-xs text-muted-soft mt-1">
            Allez dans <span className="text-ink">Analyser</span> pour déposer un compte-rendu de prise de sang.
          </p>
        </div>
      ) : (
        <>
          <MarkersByCategory markers={markers} byMarker={byMarker} />
          <BilansHistory bilans={bilans} markers={markers} />
        </>
      )}
    </div>
  );
}
