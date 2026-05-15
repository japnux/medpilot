-- Bookmarks d'items de veille (essais, publications, centres, ressources, alertes)
-- Scopés par utilisateur ET par famille. Chaque membre de la famille a ses
-- propres items épinglés. La metadata stocke un snapshot pour survie aux
-- régénérations de veille.
create table if not exists public.user_watch_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  item_type text not null check (item_type in ('trial', 'publication', 'expert_center', 'patient_resource', 'alert')),
  item_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, family_id, item_type, item_key)
);

create index if not exists user_watch_bookmarks_family_idx
  on public.user_watch_bookmarks(user_id, family_id);

alter table public.user_watch_bookmarks enable row level security;

create policy "watch_bookmarks_own_select" on public.user_watch_bookmarks
  for select to authenticated using (user_id = auth.uid());

create policy "watch_bookmarks_own_insert" on public.user_watch_bookmarks
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_family_member(family_id)
  );

create policy "watch_bookmarks_own_delete" on public.user_watch_bookmarks
  for delete to authenticated using (user_id = auth.uid());
