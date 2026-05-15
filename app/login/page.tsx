"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

/**
 * Page de connexion.
 * - Magic link par email (signInWithOtp)
 * - OAuth Google (signInWithOAuth)
 * Redirection après callback : géré par /auth/callback + middleware.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function handleGoogle() {
    setStatus("loading");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-ink">Connexion</h1>
          <p className="text-muted text-sm">
            Accédez à votre dossier familial MedPilot.
          </p>
        </div>

        {status === "sent" ? (
          <div className="rounded-lg border border-success/30 bg-canvas-soft p-4 text-center text-sm text-success">
            Lien envoyé à <span className="font-medium">{email}</span>.
            Vérifiez votre boîte mail.
          </div>
        ) : (
          <>
            {/* Magic link */}
            <form onSubmit={handleMagicLink} className="space-y-3">
              <label className="block text-sm text-body">
                Adresse email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="mt-1 w-full h-11 px-3 rounded-lg bg-surface-card border border-hairline-strong text-ink focus:border-ink focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full h-11 rounded-lg bg-primary hover:bg-primary-active disabled:opacity-50 text-on-primary font-medium transition-colors"
              >
                {status === "loading" ? "..." : "Recevoir un lien magique"}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-surface-strong"></div>
              <span className="text-xs text-muted">ou</span>
              <div className="flex-1 h-px bg-surface-strong"></div>
            </div>

            {/* OAuth Google */}
            <button
              onClick={handleGoogle}
              disabled={status === "loading"}
              className="w-full h-11 rounded-lg border border-hairline-strong hover:border-hairline-strong hover:bg-surface-card disabled:opacity-50 text-body-strong font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                />
              </svg>
              Continuer avec Google
            </button>

            {error && (
              <p className="text-sm text-error text-center">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
