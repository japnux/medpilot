import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback OAuth + magic link.
 * Échange le code contre une session, puis redirige.
 * Le middleware se chargera ensuite de rediriger vers /onboarding ou /dashboard
 * selon l'état de l'utilisateur.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Échec : retour login avec message d'erreur
  return NextResponse.redirect(`${origin}/login?error=auth-failed`);
}
