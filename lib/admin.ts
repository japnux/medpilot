/**
 * Helpers admin : check si l'utilisateur courant est admin global de la plateforme.
 *
 * Mécanisme : la variable d'env ADMIN_EMAILS contient une liste d'emails
 * (séparés par virgule) qui ont accès à la console /admin.
 *
 * Côté serveur uniquement.
 */

import { createClient } from "@/lib/supabase/server";

/** Parse ADMIN_EMAILS en set normalisé (lowercase). */
export function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True si l'email passé est dans la whitelist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.toLowerCase());
}

/**
 * Récupère l'utilisateur connecté et renvoie { user, isAdmin }.
 * Si pas connecté → user = null.
 */
export async function getAdminContext(): Promise<{
  user: { id: string; email: string | null } | null;
  isAdmin: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false };
  return {
    user: { id: user.id, email: user.email ?? null },
    isAdmin: isAdminEmail(user.email),
  };
}
