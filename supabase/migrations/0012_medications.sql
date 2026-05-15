-- =====================================================================
-- MedPilot — Module Medication, Lot 1 (MVP source de vérité IA)
-- Table medications : liste manuelle des traitements médicamenteux du
-- patient. Saisie par n'importe quel membre de la famille, visible et
-- éditable par tous, injectée dans les prompts IA (M1, M3, M5).
-- =====================================================================

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  -- Identité
  name text not null,                    -- ex : "Mitotane", "Hydrocortisone"
  brand_name text,                       -- ex : "Lysodren"
  active_ingredient text,                -- DCI (si différent de name)
  dosage text,                           -- ex : "500 mg"
  form text,                             -- ex : "comprimé", "ampoule injectable"

  -- Posologie (texte libre en MVP, structuration au Lot 3)
  posology text not null,
  route text not null default 'oral' check (route in (
    'oral', 'im', 'iv', 'sc', 'topical', 'inhaled', 'sublingual', 'other'
  )),

  -- Contexte clinique
  indication text,
  prescriber text,

  -- Dates
  started_at date,
  ended_at date,

  -- Statut
  status text not null default 'active' check (status in (
    'active', 'stopped', 'paused', 'planned'
  )),
  status_reason text,

  -- Notes libres
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medications_family_status on public.medications(family_id, status);
create index if not exists idx_medications_family_active on public.medications(family_id) where status = 'active';

-- Trigger updated_at (fonction partagée, idempotente)
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists medications_set_updated_at on public.medications;
create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- RLS famille (mêmes patterns que biology_records, timeline_events, etc.)
alter table public.medications enable row level security;

drop policy if exists "medications_family_select" on public.medications;
create policy "medications_family_select" on public.medications
  for select using (
    family_id in (select family_id from public.family_members where user_id = auth.uid())
  );

drop policy if exists "medications_family_insert" on public.medications;
create policy "medications_family_insert" on public.medications
  for insert with check (
    family_id in (select family_id from public.family_members where user_id = auth.uid())
  );

drop policy if exists "medications_family_update" on public.medications;
create policy "medications_family_update" on public.medications
  for update using (
    family_id in (select family_id from public.family_members where user_id = auth.uid())
  );

drop policy if exists "medications_family_delete" on public.medications;
create policy "medications_family_delete" on public.medications
  for delete using (
    family_id in (select family_id from public.family_members where user_id = auth.uid())
  );

-- Realtime
alter publication supabase_realtime add table public.medications;
