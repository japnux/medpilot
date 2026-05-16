"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileSearch,
  Stethoscope,
  History,
  Telescope,
  Settings,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

interface NavItem {
  href: string;
  label: string;
  /** Emoji compact (mode plié + cohérence visuelle médicale). */
  emoji: string;
  /** Sous-menus = onglets de la page (déplie au hover/click). */
  tabs?: Array<{ id: string; label: string }>;
  /** Badge numérique optionnel (notifications, décisions en attente, médicaments actifs, …). */
  badge?: number;
}

const BIOLOGIE_TABS = [
  { id: "trends", label: "Tendances" },
  { id: "markers", label: "Marqueurs" },
  { id: "history", label: "Historique" },
];

const CANCER_TABS = [
  { id: "essentiel", label: "Essentiel" },
  { id: "medical", label: "Médical" },
  { id: "surveillance", label: "Surveillance" },
  { id: "recherche", label: "Recherche & options" },
];

const WATCH_TABS_NAV = [
  { id: "synthese", label: "Synthèse" },
  { id: "actions", label: "Actions à mener" },
  { id: "reseau", label: "Réseau & ressources" },
  { id: "publications", label: "Publications" },
];

interface SidebarProps {
  cancerType?: string | null;
  /** Prénom du patient pour l'identité en haut de sidebar. */
  patientName?: string | null;
  /** True si l'utilisateur est admin global (ADMIN_EMAILS). */
  isAdmin?: boolean;
  /** Nombre de décisions en attente (affiche un badge sur l'entrée). */
  pendingDecisionsCount?: number;
  /** Nombre de médicaments actifs (badge sur l'entrée Médicaments). */
  medicationsActiveCount?: number;
  /** Nombre de symptômes critiques non résolus (badge rouge sur Symptômes). */
  criticalSymptomsCount?: number;
}

const STORAGE_KEY = "medpilot:sidebar:collapsed";

export default function Sidebar({
  cancerType,
  patientName,
  isAdmin,
  pendingDecisionsCount = 0,
  medicationsActiveCount,
  criticalSymptomsCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persistance de l'état plié
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const NAV: NavItem[] = [
    { href: "/analyzer", label: "Analyser", emoji: "📄" },
    {
      href: "/biologie",
      label: "Biologie",
      emoji: "🧬",
      tabs: BIOLOGIE_TABS,
    },
    { href: "/consultation", label: "Consultation", emoji: "🩺" },
    {
      href: "/decisions",
      label: "Décisions",
      emoji: "🎯",
      badge: pendingDecisionsCount,
    },
    {
      href: "/medications",
      label: "Médicaments",
      emoji: "💊",
      badge: medicationsActiveCount,
    },
    {
      href: "/symptoms",
      label: "Symptômes",
      emoji: "🌡️",
      badge: criticalSymptomsCount > 0 ? criticalSymptomsCount : undefined,
    },
    { href: "/timeline", label: "Timeline", emoji: "🗓️" },
    { href: "/watch", label: "Veille", emoji: "🔭", tabs: WATCH_TABS_NAV },
  ];
  if (cancerType) {
    NAV.push({
      href: `/knowledge/${cancerType}`,
      label: "Cancer",
      emoji: "🦀",
      tabs: CANCER_TABS,
    });
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Largeur dynamique côté desktop uniquement. Sur mobile, l'overlay impose w-72.
  const widthClassDesktop = collapsed ? "md:w-14" : "md:w-60";

  return (
    <>
      {/* Bouton hamburger mobile (toujours visible en haut à gauche) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-md bg-canvas border border-hairline flex items-center justify-center text-ink shadow-sm"
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-ink/40"
        />
      )}

      {/* Sidebar :
            - Mobile fermé  → hidden
            - Mobile ouvert → overlay fixed plein écran (h-[100dvh] gère la barre d'URL iOS,
              safe-area bottom évite que la déco/réglages soient masqués par le home indicator)
            - Desktop (md+) → sticky dans le flux, largeur dynamique selon collapsed */}
      <aside
        className={`flex-col border-r border-hairline bg-canvas-soft p-3 transition-all
          md:flex md:sticky md:top-0 md:h-screen ${widthClassDesktop}
          ${
            mobileOpen
              ? "flex fixed inset-y-0 left-0 z-50 w-72 h-[100dvh] pb-[env(safe-area-inset-bottom)]"
              : "hidden"
          }
        `}
      >
        {/* En-tête : identité patient + bouton collapse */}
        <div className="flex items-center gap-2 mb-4 px-1">
          {!collapsed && patientName && (
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-ink truncate">{patientName}</p>
            </div>
          )}
          {!collapsed && !patientName && (
            <Link
              href="/timeline"
              className="text-base font-medium text-ink min-w-0 flex-1"
            >
              MedPilot
            </Link>
          )}
          {/* Toggle collapse desktop / close mobile */}
          <button
            type="button"
            onClick={mobileOpen ? () => setMobileOpen(false) : toggleCollapsed}
            className="shrink-0 w-7 h-7 rounded-md text-muted hover:text-ink hover:bg-surface-card flex items-center justify-center"
            aria-label={collapsed ? "Déplier" : "Replier"}
          >
            {mobileOpen ? (
              <X className="w-4 h-4" />
            ) : collapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Nav principale */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const activeTab = active && item.tabs ? searchParams.get("tab") : null;
            const showSubmenu = !collapsed && item.tabs && active;
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-surface-card text-ink"
                      : "text-body hover:text-ink hover:bg-surface-card"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <span
                    className="text-base leading-none shrink-0"
                    aria-hidden
                  >
                    {item.emoji}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{item.label}</span>
                      {typeof item.badge === "number" && item.badge > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-canvas text-[10px] font-medium flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && typeof item.badge === "number" && item.badge > 0 && (
                    <span className="absolute -mt-3 ml-3 min-w-[14px] h-[14px] px-0.5 rounded-full bg-warning text-canvas text-[9px] font-medium flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
                {/* Sous-menus = tabs de la page active */}
                {showSubmenu && (
                  <ul className="mt-0.5 mb-1 ml-9 space-y-0.5 border-l border-hairline pl-2">
                    {item.tabs!.map((t) => {
                      const isActiveTab =
                        activeTab === t.id ||
                        (activeTab == null && t.id === item.tabs![0].id);
                      return (
                        <li key={t.id}>
                          <Link
                            href={`${item.href}?tab=${t.id}`}
                            onClick={() => setMobileOpen(false)}
                            className={`block px-2 py-1 rounded text-xs transition-colors ${
                              isActiveTab
                                ? "text-ink font-medium"
                                : "text-muted hover:text-ink"
                            }`}
                          >
                            {t.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Pied : Nouveautés + Admin (si autorisé) + Paramètres + Déconnexion */}
        <div className="pt-3 mt-3 border-t border-hairline space-y-0.5">
          <Link
            href="/changelog"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "Nouveautés" : undefined}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
              pathname.startsWith("/changelog")
                ? "bg-surface-card text-ink"
                : "text-body hover:text-ink hover:bg-surface-card"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Nouveautés</span>}
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Admin" : undefined}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-surface-card text-ink"
                  : "text-body hover:text-ink hover:bg-surface-card"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Admin</span>}
            </Link>
          )}
          <Link
            href="/help"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "Aide" : undefined}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
              pathname.startsWith("/help")
                ? "bg-surface-card text-ink"
                : "text-body hover:text-ink hover:bg-surface-card"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Aide</span>}
          </Link>
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "Paramètres" : undefined}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-surface-card text-ink"
                : "text-body hover:text-ink hover:bg-surface-card"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Paramètres</span>}
          </Link>
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Déconnexion" : undefined}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm text-body hover:text-ink hover:bg-surface-card ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
