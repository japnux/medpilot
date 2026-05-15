-- Ajoute le nom du médecin signataire d'un document médical.
-- Extrait automatiquement par Claude pendant l'analyse, stocké en colonne
-- dédiée pour pouvoir filtrer/afficher sans déserialiser tout l'analysis_summary.

alter table public.medical_documents
  add column if not exists doctor_name text;
