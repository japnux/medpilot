import { Phone, BookOpen, Users, Heart, ExternalLink } from "lucide-react";

export const dynamic = "force-static";

/**
 * /espace — Espace souffle.
 * Ressources de soutien curées : associations FR, lignes d'écoute, livres,
 * podcasts. Sobre, sans chiffres ni statistiques.
 * Sections séparées pour le patient et pour le proche aidant — les besoins
 * et la fatigue sont différents.
 */
export default function EspacePage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-ink mb-2">
          Espace souffle
        </h1>
        <p className="text-sm text-muted leading-relaxed">
          Quand l&apos;app médicale fatigue, voici des ressources pour respirer.
          Aucun chiffre ici — juste des numéros utiles, des lectures, des
          contacts.
        </p>
      </header>

      {/* Urgence émotionnelle */}
      <Section
        icon={<Phone className="w-4 h-4 text-rose-700" />}
        title="Vous traversez un moment difficile, là, maintenant"
      >
        <p className="text-sm text-body mb-3">
          Ces lignes sont gratuites, anonymes, ouvertes jour et nuit.
        </p>
        <ul className="space-y-2 text-sm">
          <Resource
            label="SOS Amitié"
            detail="24h/24, 7j/7 — 09 72 39 40 50"
            href="https://www.sos-amitie.com/"
          />
          <Resource
            label="Suicide Écoute"
            detail="24h/24 — 01 45 39 40 00"
            href="https://www.suicide-ecoute.fr/"
          />
          <Resource
            label="Cancer Info — Institut National du Cancer"
            detail="Du lundi au vendredi, 9h-19h — 0 805 123 124 (gratuit)"
            href="https://www.e-cancer.fr/Cancer-info"
          />
        </ul>
      </Section>

      {/* Pour le patient */}
      <Section
        icon={<Heart className="w-4 h-4 text-fuchsia-700" />}
        title="Si vous êtes le patient"
      >
        <p className="text-sm text-body mb-3">
          Le diagnostic, les rendez-vous, les traitements. Ces ressources sont
          faites pour vous, pas pour les chiffres.
        </p>
        <ul className="space-y-2 text-sm">
          <Resource
            label="La Ligue contre le cancer — Comités départementaux"
            detail="Accompagnement individuel, groupes de parole, soutien psy gratuit"
            href="https://www.ligue-cancer.net/"
          />
          <Resource
            label="Rose Up"
            detail="Magazine, podcasts, communauté — par et pour les femmes face au cancer"
            href="https://www.rose-up.fr/"
          />
          <Resource
            label="Patients en Réseau"
            detail="Communautés patient·e·s par type de cancer, témoignages"
            href="https://www.patientsenreseau.fr/"
          />
          <Resource
            label="Onco-Hub"
            detail="Plateforme d'entraide pour les jeunes adultes (18-40 ans)"
            href="https://onco-hub.fr/"
          />
        </ul>
      </Section>

      {/* Pour les proches */}
      <Section
        icon={<Users className="w-4 h-4 text-blue-700" />}
        title="Si vous êtes le proche aidant"
      >
        <p className="text-sm text-body mb-3">
          Accompagner épuise. Ces ressources reconnaissent ça, sans culpabilité.
        </p>
        <ul className="space-y-2 text-sm">
          <Resource
            label="Avec Nos Proches"
            detail="01 84 72 94 72 — ligne d'écoute pour les aidants, par des aidants"
            href="https://www.avecnosproches.com/"
          />
          <Resource
            label="Ma Boussole Aidants"
            detail="Repères concrets : démarches, droits, congés, pauses"
            href="https://maboussoleaidants.fr/"
          />
          <Resource
            label="Association Française des Aidants"
            detail="Cafés des aidants, formations, plaidoyer"
            href="https://www.aidants.fr/"
          />
          <Resource
            label="Allô Aidants — France Alzheimer"
            detail="0 800 97 20 97 — couvre aussi les aidants oncologie"
            href="https://www.francealzheimer.org/"
          />
        </ul>
      </Section>

      {/* Lectures / podcasts */}
      <Section
        icon={<BookOpen className="w-4 h-4 text-emerald-700" />}
        title="Lectures et podcasts pour souffler"
      >
        <ul className="space-y-2 text-sm">
          <Resource
            label="Podcast « Cancer Parlons-en »"
            detail="Témoignages courts, sans pathos. Par Rose Up."
            href="https://www.rose-up.fr/podcast-cancer-parlons-en/"
          />
          <Resource
            label="« Mon corps est un champ de bataille » — Lucy Vincent"
            detail="Lecture courte sur l'acceptation après diagnostic. Disponible en bibliothèque."
          />
          <Resource
            label="« L'aidant et le malade » — Christophe Fauré"
            detail="Pour comprendre la fatigue d'accompagner et y répondre."
          />
          <Resource
            label="Podcast « Bliss »"
            detail="Santé mentale, pas centré cancer mais utile pour les aidants."
            href="https://podcast.ausha.co/bliss-floraisons"
          />
        </ul>
      </Section>

      <footer className="text-xs text-muted-soft text-center pt-6 border-t border-hairline">
        Cette page est curée à la main, pas générée par IA. Ces ressources
        nous semblent fiables et accessibles, mais elles ne remplacent pas un
        accompagnement par un professionnel de santé ou un psychologue.
      </footer>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-canvas-soft p-5">
      <h2 className="text-base font-medium text-ink flex items-center gap-2 mb-3">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Resource({
  label,
  detail,
  href,
}: {
  label: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="font-medium text-ink">{label}</span>
      <span className="block text-xs text-muted mt-0.5">{detail}</span>
    </>
  );
  if (!href) {
    return (
      <li className="bg-canvas rounded-md px-3 py-2 border border-hairline">
        {content}
      </li>
    );
  }
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-canvas rounded-md px-3 py-2 border border-hairline hover:border-hairline-strong hover:text-ink transition-colors"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">{content}</span>
          <ExternalLink className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
        </span>
      </a>
    </li>
  );
}
