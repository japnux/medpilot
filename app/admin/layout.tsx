import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";

const TABS = [
  { href: "/admin", label: "Vue d'ensemble", emoji: "📊" },
  { href: "/admin/ai", label: "Usage IA", emoji: "🤖" },
  { href: "/admin/families", label: "Familles", emoji: "👨‍👩‍👧" },
  { href: "/admin/logs", label: "Logs", emoji: "📜" },
  { href: "/admin/knowledge", label: "Knowledge", emoji: "📚" },
  { href: "/admin/changelog", label: "Changelog", emoji: "✨" },
  { href: "/admin/regen", label: "Regen", emoji: "🔄" },
];

/**
 * Layout console admin : protégé par whitelist ADMIN_EMAILS (env).
 * Pas de sidebar partagée — propre nav minimaliste.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin } = await getAdminContext();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/timeline");

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      {/* En-tête admin */}
      <header className="border-b border-hairline bg-canvas-soft">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-base font-semibold text-ink">
              MedPilot · Admin
            </Link>
            <span className="text-xs text-muted">{user.email}</span>
          </div>
          <Link
            href="/timeline"
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            ← Retour à l&apos;app
          </Link>
        </div>
        {/* Nav onglets (segmented control) */}
        <div className="max-w-7xl mx-auto px-6 pb-3">
          <nav className="inline-flex flex-wrap bg-canvas border border-hairline rounded-lg p-1 gap-1">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-muted hover:bg-canvas-soft hover:text-ink transition-colors"
              >
                <span>{t.emoji}</span>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
