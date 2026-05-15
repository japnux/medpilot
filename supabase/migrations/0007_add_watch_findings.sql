-- Module 5 — Veille proactive
-- Cache des résultats de veille (essais cliniques, publications, centres experts,
-- ressources patient, alertes contextuelles) générés via Claude Opus + web_search.

create table if not exists public.watch_findings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  patient_context jsonb not null,
  clinical_trials jsonb not null default '[]'::jsonb,
  publications jsonb not null default '[]'::jsonb,
  expert_centers jsonb not null default '[]'::jsonb,
  patient_resources jsonb not null default '[]'::jsonb,
  contextual_alerts jsonb not null default '[]'::jsonb,
  executive_summary text,
  top_priorities jsonb not null default '[]'::jsonb,
  model_used text not null default 'claude-opus-4-7',
  token_usage jsonb,
  is_archived boolean not null default false
);

create index if not exists watch_findings_family_idx
  on public.watch_findings(family_id, generated_at desc);

alter table public.watch_findings enable row level security;

create policy "watch_findings_select" on public.watch_findings
  for select to authenticated using (public.is_family_member(family_id));
create policy "watch_findings_insert" on public.watch_findings
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "watch_findings_update" on public.watch_findings
  for update to authenticated using (public.is_family_member(family_id));
create policy "watch_findings_delete" on public.watch_findings
  for delete to authenticated using (public.is_family_admin(family_id));
