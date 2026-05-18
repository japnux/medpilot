/**
 * Helpers tone qui dépendent de Supabase server. Séparé de lib/tone.ts pour
 * que le helper pur (substitutions, métadonnées) soit importable depuis les
 * client components.
 */

import { createClient } from "@/lib/supabase/server";
import type { TonePreference } from "@/types/database";

/** Récupère la tonalité préférée de l'utilisateur courant. Default : balanced. */
export async function getToneForUser(): Promise<TonePreference> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "balanced";
  const { data } = await supabase
    .from("family_members")
    .select("tone_preference")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data?.tone_preference as TonePreference) ?? "balanced";
}
