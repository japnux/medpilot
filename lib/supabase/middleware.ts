import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Middleware Supabase : rafraîchit le token de session, puis applique la
 * logique de redirection.
 *
 * Routes publiques : "/", "/login", "/auth/*"
 * Routes "app" (protégées + famille onboardée) : tout le reste
 * "/onboarding" : protégé mais avant onboarding
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // .getUser() force la validation du JWT côté serveur
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/auth");

  // 1. Pas de session sur route protégée → login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2. Session OK
  if (user) {
    // Vérifier si l'utilisateur appartient à une famille onboardée
    const { data: membership } = await supabase
      .from("family_members")
      .select("family_id, families!inner(onboarding_completed)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const onboarded = Boolean(
      membership &&
        (membership as unknown as { families: { onboarding_completed: boolean } })
          .families?.onboarding_completed,
    );

    const isOnboardingPath = path.startsWith("/onboarding");
    const isLoginPath = path.startsWith("/login");

    // 2a. Onboardé + sur login/onboarding/root → dashboard
    if (onboarded && (isLoginPath || isOnboardingPath || path === "/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // 2b. Pas onboardé + pas sur onboarding + pas sur login + pas root → /onboarding
    if (!onboarded && !isOnboardingPath && !isLoginPath && path !== "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // 2c. Connecté sur root, pas onboardé → /onboarding
    if (!onboarded && path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
