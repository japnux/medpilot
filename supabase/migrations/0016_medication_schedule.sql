-- 0016_medication_schedule.sql
-- Plan posologique structuré : N paliers datés par médicament.
-- Cas d'usage : schéma dégressif (corticoïdes), traitement à durée limitée
-- (antibio sur 7j), alternance, etc.
--
-- Le palier "en cours" est calculé à la volée selon today :
--   start_date <= today AND (end_date IS NULL OR end_date >= today)
--
-- end_date NULL = palier de maintenance (jusqu'à arrêt explicite).

create table if not exists public.medication_schedule_steps (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  -- Ordre d'affichage / séquence (1, 2, 3...)
  step_order integer not null,
  -- Plage temporelle du palier
  start_date date not null,
  end_date date, -- null = pas de fin prévue (maintenance)
  -- Dose et posologie de ce palier (texte libre, comme la fiche médicament)
  dosage text,
  posology text not null,
  -- Notes / contexte (ex: "décroissance hebdo", "selon symptômes")
  notes text,
  created_at timestamptz not null default now(),
  -- Garantit l'unicité de l'ordre par médicament
  unique (medication_id, step_order)
);

create index if not exists med_sched_med_idx
  on public.medication_schedule_steps (medication_id, step_order);
create index if not exists med_sched_date_idx
  on public.medication_schedule_steps (medication_id, start_date);

alter table public.medication_schedule_steps enable row level security;

-- Policies : accès si membre de la famille du médicament parent.
-- Les jointures via medications protègent la chaîne family.
create policy "med_sched_select_member" on public.medication_schedule_steps
  for select to authenticated
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_id
        and public.is_family_member(m.family_id)
    )
  );

create policy "med_sched_insert_member" on public.medication_schedule_steps
  for insert to authenticated
  with check (
    exists (
      select 1 from public.medications m
      where m.id = medication_id
        and public.is_family_member(m.family_id)
    )
  );

create policy "med_sched_update_member" on public.medication_schedule_steps
  for update to authenticated
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_id
        and public.is_family_member(m.family_id)
    )
  );

create policy "med_sched_delete_member" on public.medication_schedule_steps
  for delete to authenticated
  using (
    exists (
      select 1 from public.medications m
      where m.id = medication_id
        and public.is_family_member(m.family_id)
    )
  );
