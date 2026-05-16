-- 0015_add_changelog.sql
-- Journal des nouveautés (changelog) générées à partir des commits Git.
-- Chaque entrée correspond à un commit, transformée en formulation
-- user-friendly via Claude Haiku.

create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant Git
  commit_sha text not null unique,
  commit_date timestamptz not null,
  commit_message text not null,
  commit_author text,
  -- Transformation user-friendly
  title text not null,
  summary text,
  category text not null default 'improvement',
    -- 'feature' | 'improvement' | 'fix' | 'internal'
  -- Si false, ne pas afficher côté user (commits purement techniques)
  user_visible boolean not null default true,
  -- Pour les pastilles "Nouveau" dans la sidebar
  published_at timestamptz not null default now(),
  -- Métadonnées génération
  generated_model text,
  generated_at timestamptz not null default now()
);

create index if not exists changelog_entries_published_idx
  on public.changelog_entries (published_at desc);
create index if not exists changelog_entries_user_visible_idx
  on public.changelog_entries (user_visible, published_at desc);

-- RLS : lecture publique pour les users authentifiés.
-- Pas d'insert/update côté client : tout passe par service_role.
alter table public.changelog_entries enable row level security;

create policy "changelog_select_authenticated"
  on public.changelog_entries
  for select
  to authenticated
  using (user_visible = true);
