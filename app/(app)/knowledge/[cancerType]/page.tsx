import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KnowledgeBaseView from "@/components/knowledge/KnowledgeBaseView";
import KickoffButton from "@/components/knowledge/KickoffButton";
import { CANCER_PROFILES } from "@/lib/cancer-profiles";
import type { CancerKnowledge } from "@/lib/knowledge-prompts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ cancerType: string }>;
}

export default async function KnowledgePage({ params }: PageProps) {
  const { cancerType } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: kb } = await supabase
    .from("cancer_knowledge_base")
    .select("*")
    .eq("cancer_type", cancerType)
    .maybeSingle();

  if (!kb) {
    // KB pas encore générée : on affiche un état "à lancer"
    const profile = CANCER_PROFILES[cancerType];
    if (!profile) notFound();
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card-feature text-center py-12 space-y-3">
          <h1 className="text-ink">{profile.label}</h1>
          <p className="text-sm text-muted max-w-md mx-auto">
            La fiche de référence pour ce cancer n&apos;a pas encore été générée.
            Lancez la première génération (1 à 3 minutes).
          </p>
          <div className="flex justify-center">
            <KickoffButton cancerType={cancerType} cancerTypeLabel={profile.label} />
          </div>
        </div>
      </div>
    );
  }

  const data: CancerKnowledge = {
    overview: (kb.overview as CancerKnowledge["overview"]) ?? {},
    expert_network: (kb.expert_network as CancerKnowledge["expert_network"]) ?? [],
    staging_classification:
      (kb.staging_classification as CancerKnowledge["staging_classification"]) ?? {},
    biomarkers: (kb.biomarkers as CancerKnowledge["biomarkers"]) ?? [],
    standard_protocols: (kb.standard_protocols as CancerKnowledge["standard_protocols"]) ?? [],
    clinical_trials_landscape:
      (kb.clinical_trials_landscape as CancerKnowledge["clinical_trials_landscape"]) ?? [],
    surveillance_recommendations:
      (kb.surveillance_recommendations as CancerKnowledge["surveillance_recommendations"]) ?? {},
    side_effects_to_monitor:
      (kb.side_effects_to_monitor as CancerKnowledge["side_effects_to_monitor"]) ?? [],
    red_flags: (kb.red_flags as CancerKnowledge["red_flags"]) ?? [],
    genetic_considerations:
      (kb.genetic_considerations as CancerKnowledge["genetic_considerations"]) ?? {},
    patient_resources: (kb.patient_resources as CancerKnowledge["patient_resources"]) ?? [],
    key_questions_for_team:
      (kb.key_questions_for_team as CancerKnowledge["key_questions_for_team"]) ?? [],
    recent_updates: (kb.recent_updates as CancerKnowledge["recent_updates"]) ?? [],
    sources: (kb.sources as CancerKnowledge["sources"]) ?? [],
  };

  return (
    <KnowledgeBaseView
      cancerType={kb.cancer_type}
      cancerTypeLabel={kb.cancer_type_label}
      status={kb.status}
      generatedAt={kb.generated_at}
      version={kb.version}
      data={data}
    />
  );
}

