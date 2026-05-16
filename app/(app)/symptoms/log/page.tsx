import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuickLogger from "@/components/symptoms/QuickLogger";
import { buildSymptomCatalog } from "@/lib/symptom-catalog";

export const dynamic = "force-dynamic";

export default async function SymptomLogPage() {
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

  // Catalogue depuis la KB cancer du patient (side_effects_to_monitor)
  const { data: profile } = await supabase
    .from("cancer_profiles")
    .select("cancer_type")
    .eq("family_id", membership.family_id)
    .maybeSingle();

  let kb: { side_effects_to_monitor?: unknown } | null = null;
  if (profile?.cancer_type) {
    const { data } = await supabase
      .from("cancer_knowledge_base")
      .select("side_effects_to_monitor")
      .eq("cancer_type", profile.cancer_type)
      .maybeSingle();
    kb = data;
  }

  const catalog = buildSymptomCatalog(kb);

  return <QuickLogger familyId={membership.family_id} catalog={catalog} />;
}
