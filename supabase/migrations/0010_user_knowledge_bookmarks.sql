-- Bookmarks user-scopés sur les sections de la fiche cancer.
-- Chaque membre de la famille a ses propres préférences d'épinglage.
create table if not exists public.user_knowledge_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cancer_type text not null,
  section_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, cancer_type, section_id)
);

create index if not exists user_bookmarks_lookup_idx
  on public.user_knowledge_bookmarks(user_id, cancer_type);

alter table public.user_knowledge_bookmarks enable row level security;

create policy "bookmarks_own_select" on public.user_knowledge_bookmarks
  for select to authenticated using (user_id = auth.uid());
create policy "bookmarks_own_insert" on public.user_knowledge_bookmarks
  for insert to authenticated with check (user_id = auth.uid());
create policy "bookmarks_own_delete" on public.user_knowledge_bookmarks
  for delete to authenticated using (user_id = auth.uid());
