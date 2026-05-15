"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileSearch,
  Activity,
  Stethoscope,
  History,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

const NAV = [
  { href: "/analyzer", label: "Analyser", icon: FileSearch },
  { href: "/biologie", label: "Biologie", icon: Activity },
  { href: "/consultation", label: "Consultation", icon: Stethoscope },
  { href: "/timeline", label: "Timeline", icon: History },
];

/**
 * Sidebar desktop (fixe à gauche) + bottom nav mobile.
 * Navigation entre les 4 modules + Settings + déconnexion.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop : sidebar fixe */}
      <aside className="hidden md:flex w-60 flex-col border-r border-hairline bg-canvas-soft p-4 sticky top-0 h-screen">
        <Link
          href="/timeline"
          className="text-xl font-semibold text-ink px-2 mb-6"
        >
          MedPilot
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-surface-strong text-ink border-l-2 border-ink"
                    : "text-muted hover:text-ink hover:bg-surface-card"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-hairline pt-3 space-y-1">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-surface-strong text-ink"
                : "text-muted hover:text-ink hover:bg-surface-card"
            }`}
          >
            <Settings className="w-4 h-4" />
            Paramètres
          </Link>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-ink hover:bg-surface-card"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile : bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-hairline bg-canvas grid grid-cols-5 no-print">
        {[...NAV, { href: "/settings", label: "Réglages", icon: Settings }].map(
          (item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 text-[10px] ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                {item.label}
              </Link>
            );
          },
        )}
      </nav>
    </>
  );
}
