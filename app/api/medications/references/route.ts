import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/medications/references?q=mit
 *
 * Recherche dans la table de référence (lookup oncologie + soins de support)
 * pour l'autocomplete du champ "nom" du formulaire. Match sur name OU brand_name
 * en lowercase prefix-tolérant.
 *
 * Table publique en lecture (RLS allow select to all). On exige néanmoins une
 * session authentifiée pour limiter le bruit côté API.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  let query = supabase
    .from("medication_references")
    .select(
      "id, name, brand_name, active_ingredient, category, default_indication, wikipedia_url, vidal_url, ansm_url, common_side_effects",
    )
    .order("name", { ascending: true })
    .limit(q.length === 0 ? 50 : 10);

  if (q.length > 0) {
    // Échappe les wildcards du LIKE pour éviter qu'un user influe sur le pattern
    const safe = q.replace(/[%_]/g, "\\$&");
    const pattern = `%${safe}%`;
    query = query.or(`name.ilike.${pattern},brand_name.ilike.${pattern}`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, references: data ?? [] });
}
