# MedPilot

Suivi médical oncologique familial — open source.

Application web qui aide les patients atteints de cancer et leurs proches à
suivre le parcours médical : analyse de documents par Claude, tableau de bord
des marqueurs biologiques, préparation de consultations, timeline du parcours.

**Stack :** Next.js 16 (App Router) · Supabase (auth + DB + RLS) · Anthropic
Claude (Opus 4.7 + Haiku 4.5) · Recharts · Tailwind.

## Setup (5 étapes)

1. **Cloner et installer**
   ```bash
   git clone <repo> && cd MedPilot
   npm install
   ```

2. **Créer un projet Supabase** sur [supabase.com](https://supabase.com)
   - Activer Auth → Providers : Google OAuth + Email (magic link)
   - Appliquer la migration `supabase/migrations/0001_init.sql` via le SQL Editor

3. **Récupérer une clé Anthropic** sur [console.anthropic.com](https://console.anthropic.com)

4. **Configurer les variables d'environnement**
   ```bash
   cp .env.local.example .env.local
   # Éditer .env.local avec vos clés Supabase et Anthropic
   ```

5. **Lancer en local**
   ```bash
   npm run dev
   ```
   → http://localhost:3000

## Contribution — Ajouter un profil cancer

Les profils cancer sont définis dans `lib/cancer-profiles.ts`. Chaque profil
décrit les marqueurs biologiques pertinents (avec leurs zones cibles et
alertes), le calendrier de surveillance standard et le réseau de référence
national.

Pour ajouter un profil :

1. Ajouter une entrée dans `CANCER_PROFILES` avec la même structure que
   `corticosurrenalome` ou `breast_cancer`.
2. Sourcer les valeurs de référence (publications, recommandations sociétés
   savantes) en commentaire.
3. Ouvrir une PR.

## Licence

MIT — voir [LICENSE](LICENSE).
