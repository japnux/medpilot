import Link from "next/link";

/**
 * Landing publique simple.
 * Le middleware redirigera les utilisateurs connectés vers /dashboard.
 */
export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <main className="w-full max-w-2xl text-center space-y-8 py-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Open source — MIT
        </div>

        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
          MedPilot
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          Suivi médical oncologique familial. Analyse de documents, biologie,
          préparation de consultations et timeline du parcours — pour les
          patients et leurs proches.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            Se connecter
          </Link>
          <a
            href="https://github.com/"
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 font-medium transition-colors"
          >
            Voir sur GitHub
          </a>
        </div>

        <p className="text-xs text-slate-600 pt-12">
          Vos données médicales sont isolées par famille (RLS Supabase). Aucune
          donnée patient dans le code source.
        </p>
      </main>
    </div>
  );
}
