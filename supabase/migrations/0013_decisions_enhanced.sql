-- =====================================================================
-- Décisions : statuts étendus + colonnes obsolescence / recommandation / clustering
-- =====================================================================
-- - Nouveaux statuts : awaiting_team (à poser à l'équipe), awaiting_result
--   (en attente d'un résultat), obsolete (caduque).
-- - Obsolescence : signaux jsonb + raison + timestamp de détection.
-- - recommendation_source : trace la source d'une option recommandée
--   (document signé / KB / suggestion Claude) avec niveau de confiance.
-- - Clustering thématique : cluster_id + cluster_label (Haiku ou manuel).
-- - is_pinned : force une décision dans le Top 3.
-- - external_response_* : si l'équipe médicale a tranché sans choix patient.
-- - team_note : note libre attachée à une consultation pour status=awaiting_team.

alter table public.decisions drop constraint if exists decisions_status_check;
alter table public.decisions add constraint decisions_status_check
  check (status in ('pending','decided','awaiting_team','awaiting_result','obsolete','abandoned','na'));

alter table public.decisions
  add column if not exists obsolescence_detected_at timestamptz,
  add column if not exists obsolescence_reason text,
  add column if not exists obsolescence_signals jsonb not null default '[]'::jsonb,
  add column if not exists awaiting_result_description text,
  add column if not exists recommendation_source jsonb not null default '{}'::jsonb,
  add column if not exists cluster_id text,
  add column if not exists cluster_label text,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists external_response_summary text,
  add column if not exists external_response_source text,
  add column if not exists external_response_date date,
  add column if not exists team_note text;

create index if not exists decisions_status_v2_idx on public.decisions(family_id, status);
create index if not exists decisions_due_active_idx on public.decisions(family_id, due_date)
  where status in ('pending','awaiting_team','awaiting_result');
create index if not exists decisions_cluster_idx on public.decisions(family_id, cluster_id)
  where cluster_id is not null;
create index if not exists decisions_pinned_idx on public.decisions(family_id, is_pinned)
  where is_pinned = true;
