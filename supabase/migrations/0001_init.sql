-- =====================================================================
-- MedPilot — Migration initiale
-- Schéma multi-utilisateur (familles) + RLS strict
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Familles : une famille = un cas médical (un patient + ses accompagnants)
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- onboarding_completed permet de filtrer les familles fantômes
  onboarding_completed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Membres : lien user ↔ famille, avec rôle
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('patient', 'accompagnant', 'admin')),
  display_name text not null,
  relation text,
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index if not exists family_members_user_idx on public.family_members(user_id);
create index if not exists family_members_family_idx on public.family_members(family_id);

-- Profil cancer (1 par famille)
create table if not exists public.cancer_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null unique references public.families(id) on delete cascade,
  cancer_type text not null,        -- clé de CANCER_PROFILES (corticosurrenalome, breast_cancer, custom)
  cancer_label text not null,
  patient_first_name text,
  patient_birth_date date,
  diagnosis_date date,
  stage text,
  surgery_date date,
  surgery_result text,
  active_treatments jsonb default '[]'::jsonb,
  key_biomarkers jsonb default '[]'::jsonb,
  care_team jsonb default '[]'::jsonb,
  custom_markers jsonb default '{}'::jsonb,
  reference_network text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bilans biologiques
create table if not exists public.biology_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  recorded_at date not null,
  marker_name text not null,
  value numeric not null,
  unit text not null,
  out_of_range boolean default false,
  alert_level text check (alert_level in ('normal', 'warning', 'critical')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists biology_family_idx on public.biology_records(family_id, recorded_at desc);
create index if not exists biology_marker_idx on public.biology_records(family_id, marker_name, recorded_at desc);

-- Documents médicaux analysés
create table if not exists public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  document_type text not null check (
    document_type in ('anapath','biologie','imagerie','courrier','ordonnance','compte_rendu_op','rcp','genetique','autre')
  ),
  document_date date,
  title text not null,
  raw_text text,
  analysis_summary jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists documents_family_idx on public.medical_documents(family_id, document_date desc);

-- Consultations
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  consultation_date date not null,
  doctor_name text,
  consultation_type text check (
    consultation_type in ('oncologie','endocrinologie','chirurgie','rcp','genetique','radiologie','soins_support','autre')
  ),
  hospital text,
  prepared_questions jsonb,
  notes_during text,
  decisions_made jsonb,
  followup_actions jsonb,
  status text default 'upcoming' check (status in ('upcoming','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists consultations_family_idx on public.consultations(family_id, consultation_date desc);

-- Événements de la timeline (source unique de vérité pour le parcours)
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'surgery','consultation','biology','imaging','anapath',
      'treatment_start','treatment_adjustment','treatment_end',
      'rcp','clinical_trial','hospitalization','emergency','other'
    )
  ),
  event_date date not null,
  title text not null,
  summary text,
  is_critical boolean default false,
  linked_document_id uuid references public.medical_documents(id) on delete set null,
  linked_consultation_id uuid references public.consultations(id) on delete set null,
  linked_biology_date date,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists timeline_family_idx on public.timeline_events(family_id, event_date desc);
create index if not exists timeline_type_idx on public.timeline_events(family_id, event_type);

-- Symptômes et effets indésirables
create table if not exists public.symptom_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  logged_at timestamptz not null default now(),
  logged_by uuid references auth.users(id) on delete set null,
  digestif integer check (digestif between 0 and 10),
  neuro integer check (neuro between 0 and 10),
  fatigue integer check (fatigue between 0 and 10),
  douleur integer check (douleur between 0 and 10),
  autres jsonb,
  notes text
);

create index if not exists symptoms_family_idx on public.symptom_logs(family_id, logged_at desc);

-- Alertes de surveillance planifiée
create table if not exists public.surveillance_alerts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  alert_type text not null,
  label text not null,
  due_date date not null,
  is_done boolean default false,
  linked_event_id uuid references public.timeline_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists surveillance_family_idx on public.surveillance_alerts(family_id, due_date asc);

-- ---------------------------------------------------------------------
-- Helper function : retourne true si l'utilisateur connecté est membre
-- de la famille passée en argument.
-- Marquée SECURITY DEFINER + STABLE pour éviter la récursion RLS sur
-- family_members (sinon : policy → SELECT family_members → policy → ∞).
-- ---------------------------------------------------------------------
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- Row Level Security : tout est isolé par famille
-- ---------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.cancer_profiles enable row level security;
alter table public.biology_records enable row level security;
alter table public.medical_documents enable row level security;
alter table public.consultations enable row level security;
alter table public.timeline_events enable row level security;
alter table public.symptom_logs enable row level security;
alter table public.surveillance_alerts enable row level security;

-- ---- families ----
create policy "families_select_members" on public.families
  for select to authenticated
  using (public.is_family_member(id));

create policy "families_insert_self" on public.families
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "families_update_admin" on public.families
  for update to authenticated
  using (public.is_family_admin(id))
  with check (public.is_family_admin(id));

-- ---- family_members ----
-- Lecture : un user voit ses propres rangées, ET via helper les autres membres de sa famille
create policy "family_members_select_own" on public.family_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_family_member(family_id));

-- Insertion : un user peut s'ajouter lui-même comme membre d'une famille qu'il vient de créer,
-- OU un admin peut ajouter d'autres membres.
create policy "family_members_insert" on public.family_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_family_admin(family_id)
  );

create policy "family_members_update_admin" on public.family_members
  for update to authenticated
  using (public.is_family_admin(family_id));

create policy "family_members_delete_admin" on public.family_members
  for delete to authenticated
  using (public.is_family_admin(family_id));

-- ---- cancer_profiles ----
create policy "profiles_select" on public.cancer_profiles
  for select to authenticated using (public.is_family_member(family_id));
create policy "profiles_insert" on public.cancer_profiles
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "profiles_update" on public.cancer_profiles
  for update to authenticated using (public.is_family_admin(family_id));

-- ---- Pattern générique pour les tables data ----
-- biology, documents, consultations, timeline, symptoms, surveillance :
-- SELECT/INSERT pour tous les membres, DELETE réservé admin.

-- biology_records
create policy "biology_select" on public.biology_records
  for select to authenticated using (public.is_family_member(family_id));
create policy "biology_insert" on public.biology_records
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "biology_update" on public.biology_records
  for update to authenticated using (public.is_family_member(family_id));
create policy "biology_delete" on public.biology_records
  for delete to authenticated using (public.is_family_admin(family_id));

-- medical_documents
create policy "docs_select" on public.medical_documents
  for select to authenticated using (public.is_family_member(family_id));
create policy "docs_insert" on public.medical_documents
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "docs_update" on public.medical_documents
  for update to authenticated using (public.is_family_member(family_id));
create policy "docs_delete" on public.medical_documents
  for delete to authenticated using (public.is_family_admin(family_id));

-- consultations
create policy "consults_select" on public.consultations
  for select to authenticated using (public.is_family_member(family_id));
create policy "consults_insert" on public.consultations
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "consults_update" on public.consultations
  for update to authenticated using (public.is_family_member(family_id));
create policy "consults_delete" on public.consultations
  for delete to authenticated using (public.is_family_admin(family_id));

-- timeline_events
create policy "timeline_select" on public.timeline_events
  for select to authenticated using (public.is_family_member(family_id));
create policy "timeline_insert" on public.timeline_events
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "timeline_update" on public.timeline_events
  for update to authenticated using (public.is_family_member(family_id));
create policy "timeline_delete" on public.timeline_events
  for delete to authenticated using (public.is_family_admin(family_id));

-- symptom_logs
create policy "symptoms_select" on public.symptom_logs
  for select to authenticated using (public.is_family_member(family_id));
create policy "symptoms_insert" on public.symptom_logs
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "symptoms_update" on public.symptom_logs
  for update to authenticated using (public.is_family_member(family_id));
create policy "symptoms_delete" on public.symptom_logs
  for delete to authenticated using (public.is_family_admin(family_id));

-- surveillance_alerts
create policy "surveillance_select" on public.surveillance_alerts
  for select to authenticated using (public.is_family_member(family_id));
create policy "surveillance_insert" on public.surveillance_alerts
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "surveillance_update" on public.surveillance_alerts
  for update to authenticated using (public.is_family_member(family_id));
create policy "surveillance_delete" on public.surveillance_alerts
  for delete to authenticated using (public.is_family_admin(family_id));
