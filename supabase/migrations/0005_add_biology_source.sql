-- Trace l'origine d'un biology_record : null = saisie manuelle,
-- sinon = doc analysé qui a généré la valeur via extraction Claude.

alter table public.biology_records
  add column if not exists source_document_id uuid references public.medical_documents(id) on delete set null;

create index if not exists biology_source_idx on public.biology_records(source_document_id)
  where source_document_id is not null;
