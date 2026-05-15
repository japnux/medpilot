import Link from "next/link";

/**
 * Landing publique : gradient mesh atmosphérique (Stripi-style) en haut,
 * hero centré, CTAs pill indigo.
 * Le middleware redirige les utilisateurs connectés vers /timeline.
 */
export default function Home() {
  return (
    <div className="relative flex flex-col flex-1 overflow-hidden bg-canvas">
      {/* Gradient mesh atmosphérique (upper third) */}
      <div className="absolute inset-x-0 top-0 h-[60vh] gradient-mesh" />

      <main className="relative z-10 flex flex-col flex-1 items-center justify-center px-6">
        <div className="w-full max-w-3xl text-center space-y-8 py-24">
          <span className="badge-pill">Open source · MIT</span>

          <h1
            className="text-ink"
            style={{
              fontSize: "clamp(40px, 6vw, 56px)",
              lineHeight: 1.03,
              letterSpacing: "-1.4px",
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
        </div>
      </main>
    </div>
  );
}
