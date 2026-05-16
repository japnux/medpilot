import HelpClient from "@/components/help/HelpClient";

export const dynamic = "force-static";

/**
 * Page d'aide : FAQ user-friendly par feature. Statique, pas de fetch BDD.
 */
export default function HelpPage() {
  return <HelpClient />;
}
