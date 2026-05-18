import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KnowledgeBaseView from "@/components/knowledge/KnowledgeBaseView";
import { getToneForUser } from "@/lib/tone-server";
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

  // Helper : Claude peut parfois retourner un objet là où on attend un array
  // (sous-catégorisation libre). On aplatit en array dans ce cas.
  function asArray<T>(v: unknown): T[] {
    if (Array.isArray(v)) return v as T[];
    if (v && typeof v === "object") {
      const out: T[] = [];
      for (const val of Object.values(v as Record<string, unknown>)) {
        if (Array.isArray(val)) out.push(...(val as T[]));
        else if (val && typeof val === "object") out.push(val as T);
      }
      return out;
    }
    return [];
  }

  const data: CancerKnowledge = {
    overview: (kb.overview as CancerKnowledge["overview"]) ?? {},
    expert_network: asArray<CancerKnowledge["expert_network"][number]>(kb.expert_network),
    staging_classification:
      (kb.staging_classification as CancerKnowledge["staging_classification"]) ?? {},
    biomarkers: asArray<CancerKnowledge["biomarkers"][number]>(kb.biomarkers),
    standard_protocols: asArray<CancerKnowledge["standard_protocols"][number]>(kb.standard_protocols),
    clinical_trials_landscape: asArray<CancerKnowledge["clinical_trials_landscape"][number]>(
      kb.clinical_trials_landscape,
    ),
    surveillance_recommendations:
      (kb.surveillance_recommendations as CancerKnowledge["surveillance_recommendations"]) ?? {},
    side_effects_to_monitor: asArray<CancerKnowledge["side_effects_to_monitor"][number]>(
      kb.side_effects_to_monitor,
    ),
    red_flags: asArray<CancerKnowledge["red_flags"][number]>(kb.red_flags),
    genetic_considerations:
      (kb.genetic_considerations as CancerKnowledge["genetic_considerations"]) ?? {},
    patient_resources: asArray<CancerKnowledge["patient_resources"][number]>(kb.patient_resources),
    key_questions_for_team: asArray<CancerKnowledge["key_questions_for_team"][number]>(
      kb.key_questions_for_team,
    ),
    recent_updates: asArray<CancerKnowledge["recent_updates"][number]>(kb.recent_updates),
    sources: asArray<CancerKnowledge["sources"][number]>(kb.sources),
  };

  const tone = await getToneForUser();

  return (
    <KnowledgeBaseView
      cancerType={kb.cancer_type}
      cancerTypeLabel={kb.cancer_type_label}
      status={kb.status}
      generatedAt={kb.generated_at}
      version={kb.version}
      data={data}
      tone={tone}
    />
  );
}

