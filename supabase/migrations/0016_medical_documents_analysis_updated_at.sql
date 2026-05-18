-- =====================================================================
-- medical_documents : trace la dernière date d'analyse Claude
-- =====================================================================
-- Permet de distinguer la date de création (import du document) de la
-- date de la dernière (re-)analyse Claude. Affiché dans le header
-- doc pour confirmer visuellement qu'une ré-analyse a bien tourné.

alter table public.medical_documents
  add column if not exists analysis_updated_at timestamptz;

-- Backfill : pour les docs déjà analysés, initialise au created_at
update public.medical_documents
set analysis_updated_at = created_at
where analysis_summary is not null and analysis_updated_at is null;
