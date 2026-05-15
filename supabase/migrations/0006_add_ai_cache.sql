-- Cache des analyses IA par famille pour éviter de re-générer à chaque visite.
-- Invalidé via data_version (ex : id du dernier bilan biologique).

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  cache_type text not null,
  data_version text not null,
  content jsonb not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  generated_at timestamptz not null default now(),
  unique (family_id, cache_type)
);

create index if not exists ai_cache_family_idx on public.ai_cache(family_id);

alter table public.ai_cache enable row level security;

create policy "ai_cache_select" on public.ai_cache
  for select to authenticated using (public.is_family_member(family_id));
create policy "ai_cache_insert" on public.ai_cache
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "ai_cache_update" on public.ai_cache
  for update to authenticated using (public.is_family_member(family_id));
create policy "ai_cache_delete" on public.ai_cache
  for delete to authenticated using (public.is_family_admin(family_id));
