import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CANCER_PROFILES, type MarkerDef } from "@/lib/cancer-profiles";
import MarkerCard from "@/components/dashboard/MarkerCard";
import QuickEntryForm from "@/components/dashboard/QuickEntryForm";
import AlertBanner from "@/components/shared/AlertBanner";

export const dynamic = "force-dynamic";

/**
 * Module 2 — Tableau de bord biologique.
 * Affiche les marqueurs du profil cancer avec leur dernière valeur,
 * leur statut (normal/warning/critical) et un graphique d'évolution.
 */
export default async function DashboardPage() {
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
  // Fusion : markers standards du profil cancer + markers ajoutés dynamiquement
  // depuis les analyses de bilans biologiques. Les custom_markers viennent en
  // second pour ne pas écraser les seuils thérapeutiques du profil canonique.
  const standardMarkers =
    cancerType === "custom" ? {} : CANCER_PROFILES[cancerType]?.markers ?? {};
  const markers: Record<string, MarkerDef> = {
    ...customMarkers,
    ...standardMarkers,
  };

  // Charger l'historique biologique (1 an glissant)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: records } = await supabase
    .from("biology_records")
    .select("marker_name, value, recorded_at, alert_level")
    .eq("family_id", familyId)
    .gte("recorded_at", oneYearAgo.toISOString().slice(0, 10))
    .order("recorded_at", { ascending: false });

  // Grouper par marker_name
  const byMarker: Record<string, Array<{ recorded_at: string; value: number; alert_level: string | null }>> = {};
  for (const r of records ?? []) {
    if (!byMarker[r.marker_name]) byMarker[r.marker_name] = [];
    byMarker[r.marker_name].push({
      recorded_at: r.recorded_at,
      value: r.value,
      alert_level: r.alert_level,
    });
  }

  // Détecter les alertes critiques sur la dernière valeur de chaque marqueur
  const criticals: string[] = [];
  for (const [key, list] of Object.entries(byMarker)) {
    const last = list[0];
    if (last?.alert_level === "critical") {
      criticals.push(markers[key]?.label ?? key);
    }
  }

  const markerEntries = Object.entries(markers);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {criticals.length > 0 && (
        <AlertBanner
          title={`Alerte critique sur ${criticals.length} marqueur${criticals.length > 1 ? "s" : ""}`}
          message={`Valeurs hors zone d'alerte : ${criticals.join(", ")}. Contactez l'équipe médicale.`}
        />
      )}

      {markerEntries.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface-card p-8 text-center">
          <p className="text-muted text-sm">
            Aucun marqueur configuré pour ce profil cancer.
          </p>
          <p className="text-muted text-xs mt-1">
            Allez dans Paramètres pour personnaliser les marqueurs à suivre.
          </p>
        </div>
      ) : (
        <>
          <QuickEntryForm familyId={familyId} markers={markers} />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {markerEntries.map(([key, marker]) => (
              <MarkerCard
                key={key}
                markerKey={key}
                marker={marker}
                records={byMarker[key] ?? []}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
