-- Knowledge base partagée par type de cancer (référentiel non-sensible).
-- Lecture pour tout authentifié, écriture via service_role uniquement.

create table if not exists public.cancer_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  cancer_type text not null unique,
  cancer_type_label text not null,
  country text not null default 'France',

  overview jsonb not null default '{}'::jsonb,
  expert_network jsonb not null default '[]'::jsonb,
  staging_classification jsonb not null default '{}'::jsonb,
  biomarkers jsonb not null default '[]'::jsonb,
  standard_protocols jsonb not null default '[]'::jsonb,
  clinical_trials_landscape jsonb not null default '[]'::jsonb,
  surveillance_recommendations jsonb not null default '{}'::jsonb,
  side_effects_to_monitor jsonb not null default '[]'::jsonb,
  red_flags jsonb not null default '[]'::jsonb,
  genetic_considerations jsonb not null default '{}'::jsonb,
  patient_resources jsonb not null default '[]'::jsonb,
  key_questions_for_team jsonb not null default '[]'::jsonb,
  recent_updates jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,

  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  version int not null default 1,
  model_used text not null default 'claude-opus-4-7',
  token_usage jsonb,
  status text not null default 'ready' check (status in ('generating', 'ready', 'failed', 'stale'))
);

create index if not exists cancer_knowledge_type_idx on public.cancer_knowledge_base(cancer_type);

alter table public.cancer_knowledge_base enable row level security;

create policy "cancer_knowledge_select_auth" on public.cancer_knowledge_base
  for select to authenticated using (true);

alter table public.cancer_profiles
  add column if not exists knowledge_overrides jsonb default '{}'::jsonb,
  add column if not exists knowledge_base_id uuid references public.cancer_knowledge_base(id) on delete set null;

create index if not exists cancer_profiles_knowledge_base_idx
  on public.cancer_profiles(knowledge_base_id);
