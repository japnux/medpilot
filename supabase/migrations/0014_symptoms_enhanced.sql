-- =====================================================================
-- Symptômes & effets indésirables : extension de symptom_logs
-- =====================================================================
-- Conserve les anciennes colonnes (digestif/neuro/fatigue/douleur/autres)
-- pour compat et ajoute le modèle riche : catégorie, type, sévérité,
-- wellbeing, vital signs, contexte, lien médicament, criticité.

alter table public.symptom_logs
  add column if not exists category text
    check (category in ('digestive','neurological','cardiovascular','general','psychological','skin','musculoskeletal','respiratory','vital_sign','wellbeing','other')),
  add column if not exists symptom_type text,
  add column if not exists symptom_label text,
  add column if not exists severity int check (severity between 0 and 10),
  add column if not exists numeric_value numeric,
  add column if not exists numeric_value_2 numeric,
  add column if not exists numeric_unit text,
  add column if not exists wellbeing_score int check (wellbeing_score between 1 and 5),
  add column if not exists duration_minutes int,
  add column if not exists context text[] default array[]::text[],
  add column if not exists linked_medication_id uuid references public.medications(id) on delete set null,
  add column if not exists is_resolved boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists is_critical boolean not null default false,
  add column if not exists red_flag_matched text,
  add column if not exists matched_keywords text[] default array[]::text[],
  add column if not exists updated_at timestamptz not null default now();

create index if not exists symptom_logs_critical_idx on public.symptom_logs(family_id, is_critical)
  where is_critical = true;
create index if not exists symptom_logs_unresolved_idx on public.symptom_logs(family_id, is_resolved)
  where is_resolved = false;
create index if not exists symptom_logs_medication_idx on public.symptom_logs(linked_medication_id)
  where linked_medication_id is not null;

create or replace function public.touch_symptom_logs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists symptom_logs_updated_at on public.symptom_logs;
create trigger symptom_logs_updated_at
  before update on public.symptom_logs
  for each row execute function public.touch_symptom_logs_updated_at();

-- Vue agrégat par jour pour les graphiques tracking
create or replace view public.daily_wellbeing_check as
  select
    family_id,
    date_trunc('day', logged_at)::date as day,
    avg(wellbeing_score) filter (where wellbeing_score is not null) as avg_wellbeing,
    count(*) filter (where severity is not null) as symptom_count,
    count(*) filter (where is_critical = true) as critical_count,
    array_agg(distinct symptom_type) filter (where symptom_type is not null) as symptom_types
  from public.symptom_logs
  group by family_id, date_trunc('day', logged_at)::date;
