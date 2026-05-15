-- Hash SHA-256 du PDF source pour détecter les doublons à l'upload
alter table public.medical_documents
  add column if not exists content_hash text;

create index if not exists docs_hash_idx
  on public.medical_documents(family_id, content_hash)
  where content_hash is not null;
