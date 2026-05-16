-- =====================================================================
-- Historique des changements de dosage d'un médicament
-- =====================================================================
-- Permet de tracer la titration (typique en endocrino : hydrocortisone
-- 30→20 mg pour asthénie, etc.) sans dupliquer la row medication ni
-- perdre l'historique. Chaque changement enregistre l'avant / l'après,
-- la date, la raison clinique, et la source documentée si applicable.

create table public.medication_dosage_changes (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,

  changed_at date not null default current_date,
  previous_dosage text,
  previous_posology text,
  new_dosage text not null,
  new_posology text,

  reason text,
  prescriber text,
  source_consultation_id uuid references public.consultations(id) on delete set null,
  source_document_id uuid references public.medical_documents(id) on delete set null,
  notes text,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index medication_dosage_changes_med_idx
  on public.medication_dosage_changes(medication_id, changed_at desc);
create index medication_dosage_changes_family_idx
  on public.medication_dosage_changes(family_id, changed_at desc);

alter table public.medication_dosage_changes enable row level security;

create policy "dosage_changes_select" on public.medication_dosage_changes
  for select to authenticated using (public.is_family_member(family_id));
create policy "dosage_changes_insert" on public.medication_dosage_changes
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "dosage_changes_update" on public.medication_dosage_changes
  for update to authenticated using (public.is_family_member(family_id));
create policy "dosage_changes_delete" on public.medication_dosage_changes
  for delete to authenticated using (public.is_family_admin(family_id));
