-- 0012_add_api_usage_logs.sql
-- Tracking des appels IA (Anthropic) pour console admin :
-- coût, tokens, modèle, endpoint, contexte famille/user, succès/erreur.
-- Pattern inspiré du projet "health-dashboard".

create table if not exists public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  endpoint text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  cached boolean not null default false,
  -- Contexte (nullable car certains appels peuvent être hors-famille)
  family_id uuid references public.families(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  -- Succès / erreur
  success boolean not null default true,
  error_message text,
  -- Durée d'exécution côté serveur (ms)
  duration_ms integer
);

create index if not exists api_usage_logs_created_idx
  on public.api_usage_logs (created_at desc);
create index if not exists api_usage_logs_endpoint_idx
  on public.api_usage_logs (endpoint, created_at desc);
create index if not exists api_usage_logs_family_idx
  on public.api_usage_logs (family_id, created_at desc);

-- RLS activée mais aucune policy : la table n'est lisible/écrivable
-- qu'avec la clé service_role (côté serveur uniquement).
alter table public.api_usage_logs enable row level security;
