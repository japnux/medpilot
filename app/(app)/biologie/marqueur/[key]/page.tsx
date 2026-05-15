import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CANCER_PROFILES, type MarkerDef } from "@/lib/cancer-profiles";
import MarkerDetailClient from "@/components/dashboard/MarkerDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string }>;
}

/**
 * Détail complet d'un marqueur biologique :
 *  - En-tête : label, catégorie, dernière valeur, status
 *  - Grand chart d'évolution
 *  - Table d'historique avec delta vs précédent
 *  - Lien vers les documents sources
 */
export default async function MarkerDetailPage({ params }: PageProps) {
  const { key } = await params;
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
  const markers: Record<string, MarkerDef> = {
    ...customMarkers,
    ...standardMarkers,
  };

  const marker = markers[key];
  if (!marker) notFound();

  // Charger toutes les mesures de ce marqueur (sans limite de date)
  const { data: records } = await supabase
    .from("biology_records")
    .select("recorded_at, value, unit, alert_level, source_document_id, notes")
    .eq("family_id", familyId)
    .eq("marker_name", key)
    .order("recorded_at", { ascending: false });

  if (!records || records.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card-feature text-center py-8">
          <h1 className="text-ink">{marker.label}</h1>
          <p className="text-sm text-muted mt-2">
            Aucune mesure enregistrée pour ce marqueur.
          </p>
        </div>
      </div>
    );
  }

  // Charger les documents sources liés (pour afficher le titre dans la table)
  const docIds = Array.from(
    new Set(records.map((r) => r.source_document_id).filter(Boolean)),
  ) as string[];
  const { data: docs } = docIds.length
    ? await supabase
        .from("medical_documents")
        .select("id, title, doctor_name, document_type")
        .in("id", docIds)
    : { data: [] };
  const docById = new Map((docs ?? []).map((d) => [d.id, d]));

  // Enrichir les records avec le titre du document source
  const enriched = records.map((r) => ({
    recorded_at: r.recorded_at,
    value: r.value,
    unit: r.unit,
    alert_level: r.alert_level as "normal" | "warning" | "critical" | null,
    source: r.source_document_id
      ? docById.get(r.source_document_id) ?? null
      : null,
  }));

  return (
    <MarkerDetailClient markerKey={key} marker={marker} records={enriched} />
  );
}
