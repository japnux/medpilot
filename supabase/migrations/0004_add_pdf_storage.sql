-- Ajoute le stockage permanent des PDFs médicaux dans Supabase Storage.
-- Pattern de chemin : {family_id}/{document_id}.pdf

-- 1. Colonne storage_path sur medical_documents
alter table public.medical_documents
  add column if not exists storage_path text;

-- 2. Bucket privé limité aux PDFs ≤ 10 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-documents',
  'medical-documents',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. RLS sur storage.objects : isolation par famille via le premier segment du path
drop policy if exists "medical_docs_select" on storage.objects;
create policy "medical_docs_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1]::uuid in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  );

drop policy if exists "medical_docs_insert" on storage.objects;
create policy "medical_docs_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1]::uuid in (
      select family_id from public.family_members where user_id = auth.uid()
    )
  );

drop policy if exists "medical_docs_delete" on storage.objects;
create policy "medical_docs_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1]::uuid in (
      select family_id from public.family_members where user_id = auth.uid() and role = 'admin'
    )
  );
