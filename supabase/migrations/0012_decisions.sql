-- =====================================================================
-- Module : Décisions à trancher
-- =====================================================================
-- Modèle générique pour capter les choix soulevés par un document ou une
-- consultation : protocole oui/non, traitement A vs B, demande 2e avis,
-- ajustement dose, etc. — avec leur statut, options, rationale et
-- traçabilité vers la source.

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  -- Le sujet
  title text not null,                         -- "Inclusion protocole ADIUVO 2"
  question text,                               -- formulation précise
  category text not null default 'autre'
    check (category in (
      'essai_clinique', 'traitement', 'examen', 'surveillance',
      'second_avis', 'administratif', 'autre'
    )),
  priority text not null default 'normal'
    check (priority in ('high', 'normal', 'low')),
  due_date date,

  -- Options évaluées : [{label, pros[], cons[], recommended: bool}]
  options jsonb not null default '[]'::jsonb,

  -- Statut + décision
  status text not null default 'pending'
    check (status in ('pending', 'decided', 'abandoned', 'na')),
  decided_at date,
  chosen_option text,
  rationale text,
  decided_by text,                             -- patient | famille | RCP | équipe

  -- Traçabilité source
  source_document_id uuid references public.medical_documents(id) on delete set null,
  source_consultation_id uuid references public.consultations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decisions_family_idx on public.decisions(family_id);
create index if not exists decisions_status_idx on public.decisions(family_id, status);
create index if not exists decisions_source_doc_idx on public.decisions(source_document_id);
create index if not exists decisions_due_idx on public.decisions(family_id, due_date) where status = 'pending';

-- Trigger updated_at
create or replace function public.touch_decisions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists decisions_updated_at on public.decisions;
create trigger decisions_updated_at
  before update on public.decisions
  for each row execute function public.touch_decisions_updated_at();

-- RLS
alter table public.decisions enable row level security;

create policy "decisions_select" on public.decisions
  for select to authenticated using (public.is_family_member(family_id));
create policy "decisions_insert" on public.decisions
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "decisions_update" on public.decisions
  for update to authenticated using (public.is_family_member(family_id));
create policy "decisions_delete" on public.decisions
  for delete to authenticated using (public.is_family_admin(family_id));
