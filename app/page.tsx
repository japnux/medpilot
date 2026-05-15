import Link from "next/link";

/**
 * Landing publique : hero éditorial avec orbes atmosphériques.
 * Le middleware redirige les utilisateurs connectés vers /timeline.
 */
export default function Home() {
  return (
    <div className="relative flex flex-col flex-1 items-center justify-center px-6 overflow-hidden bg-canvas">
      {/* Orbes atmosphériques (décoratifs uniquement) */}
      <div className="orb orb-mint w-[420px] h-[420px] -top-32 -left-24" />
      <div className="orb orb-peach w-[380px] h-[380px] top-1/3 -right-32" />
      <div className="orb orb-lavender w-[340px] h-[340px] bottom-0 left-1/3" />

      <main className="relative z-10 w-full max-w-2xl text-center space-y-10 py-24">
        <span className="badge-pill">Open source · MIT</span>

        <h1
          className="font-display text-ink"
          style={{
            fontSize: "clamp(40px, 6vw, 64px)",
            lineHeight: 1.05,
            letterSpacing: "-1.92px",
            fontWeight: 300,
          }}
        >
          Suivre un parcours médical, ensemble.
        </h1>

        <p className="text-body max-w-xl mx-auto leading-relaxed text-base">
          MedPilot est une application open source de suivi médical oncologique
          familial. Analyse de documents, biologie, préparation de consultations
          et timeline du parcours — pour les patients et leurs proches.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/login" className="btn-primary">
            Se connecter
          </Link>
          <a
            href="https://github.com/japnux/medpilot"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            Voir sur GitHub
          </a>
        </div>

        <p className="text-xs text-muted pt-16">
          Vos données médicales sont isolées par famille (RLS Supabase). Aucune
          donnée patient dans le code source.
        </p>
      </main>
    </div>
  );
}
