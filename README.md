# MedPilot

Copilote du parcours oncologique pour les patients et leurs proches — open source.

Application web qui aide une famille confrontée au cancer à **centraliser**,
**comprendre** et **piloter** le parcours médical. L'IA (Claude) lit les
documents, vulgarise, prépare les consultations et fait circuler le contexte
entre tous les modules.

**Démo :** [medpilot-rho.vercel.app](https://medpilot-rho.vercel.app)

## Stack

- **Next.js 16** (App Router, Server Components)
- **Supabase** — Postgres + RLS stricte multi-familles + Storage + Auth (magic link & Google OAuth)
- **Anthropic Claude** — routing par tâche : Opus 4.7 (analyse documents, veille, KB, tendances bio), Sonnet 4.6 (préparation de consultation), Haiku 4.5 (tâches simples)
- **Tailwind v4** · **Recharts** · déploiement **Vercel**

## Modules

| Module | Rôle |
|---|---|
| **Analyser** | Import de documents médicaux (PDF/photo) → analyse Claude : résumé famille, synthèse clinique, valeurs clés, questions pour l'équipe. Extraction automatique des prescriptions, de l'équipe médicale et des décisions à trancher. |
| **Biologie** | Tendances et alertes des marqueurs biologiques, descriptions contextualisées par le cancer du patient. |
| **Consultation** | Liste des RDV à venir / passés. Préparation IA : questions ciblées à partir de tout le contexte patient. Réponses notées inline pendant le RDV. Partage WhatsApp. |
| **Décisions** | Cockpit des choix à trancher (essai clinique, traitement, examen…) avec workflow 4 chemins, détection d'obsolescence, traçabilité. |
| **Médicaments** | Traitements en cours / passés, historique des changements de dose, plans posologiques multi-paliers, alerte de fin proche. |
| **Symptômes** | Check-in quotidien (bien-être, symptômes, signes vitaux), détection de red flags via la knowledge base cancer. |
| **Timeline** | Vue chronologique du parcours en 3 sections (À venir / Aujourd'hui / Historique), badges cross-modules. |
| **Veille** | Veille proactive : essais cliniques, publications, centres experts, recommandations émergentes. |
| **Fiche cancer** | Knowledge base experte par type de cancer (staging, biomarqueurs, protocoles, red flags, surveillance). |

L'IA de chaque module est nourrie par le contexte des autres : la préparation
de consultation, par exemple, injecte profil, KB, documents, biologie,
symptômes, médicaments (avec palier en cours), équipe médicale, décisions et
veille.

## Setup

1. **Cloner et installer**
   ```bash
   git clone <repo> && cd MedPilot
   npm install
   ```

2. **Créer un projet Supabase** sur [supabase.com](https://supabase.com)
   - Auth → Providers : Google OAuth + Email (magic link)
   - Appliquer les migrations de `supabase/migrations/` dans l'ordre via le SQL Editor (ou la CLI Supabase)
   - Créer un bucket Storage `medical-documents` (privé)

3. **Récupérer une clé Anthropic** sur [console.anthropic.com](https://console.anthropic.com)

4. **Configurer les variables d'environnement**
   ```bash
   cp .env.local.example .env.local
   # Renseigner les clés Supabase (URL, anon, service_role) et Anthropic
   ```

5. **Lancer en local**
   ```bash
   npm run dev
   ```
   → http://localhost:3000

## Architecture

- `app/(app)/` — pages authentifiées (un dossier par module)
- `app/api/` — routes API : appels Claude, mutations, sync changelog, admin
- `components/` — composants UI groupés par module
- `lib/` — logique métier : prompts, helpers de contexte IA, profils cancer
- `supabase/migrations/` — schéma versionné (RLS appliquée au niveau base)

Sécurité : toutes les tables sont protégées par Row Level Security. Une
donnée n'est visible que par les membres de la famille à laquelle elle
appartient — pas de fuite possible côté API.

## Contribution — Ajouter un profil cancer

Les profils cancer vivent dans `lib/cancer-profiles.ts` : marqueurs
biologiques pertinents (zones cibles + alertes), calendrier de surveillance,
réseau de référence national.

1. Ajouter une entrée dans `CANCER_PROFILES` (cf. `corticosurrenalome`).
2. Sourcer les valeurs de référence en commentaire (publications,
   recommandations de sociétés savantes).
3. Ouvrir une PR.

## Conventions

- À chaque livraison visible : synchroniser le changelog (`/admin/changelog`)
  et mettre à jour la page d'aide (`/help`) si le comportement change.
- Cf. `AGENTS.md` pour les conventions de développement.

## Licence

MIT — voir [LICENSE](LICENSE).
