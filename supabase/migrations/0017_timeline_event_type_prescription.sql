-- =====================================================================
-- timeline_events : ajout du event_type 'prescription'
-- =====================================================================
-- Permet de distinguer les ordonnances des autres documents (anapath,
-- imagerie, courrier...) sur la timeline avec une icône et une couleur
-- dédiées (FileSignature, fuchsia).

alter table public.timeline_events drop constraint if exists timeline_events_event_type_check;
alter table public.timeline_events add constraint timeline_events_event_type_check
  check (event_type in (
    'surgery','consultation','biology','imaging','anapath',
    'treatment_start','treatment_adjustment','treatment_end',
    'prescription',
    'rcp','clinical_trial','hospitalization','emergency',
    'decision','other'
  ));

-- Backfill : reclasse les timeline_events liés à des documents 'ordonnance'
-- (auparavant en 'other' faute de mapping dédié).
update public.timeline_events te
set event_type = 'prescription'
from public.medical_documents md
where te.linked_document_id = md.id
  and md.document_type = 'ordonnance'
  and te.event_type != 'prescription';
