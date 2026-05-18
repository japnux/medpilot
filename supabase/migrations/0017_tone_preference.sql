-- 0017_tone_preference.sql
-- Tonalité de l'app, par utilisateur (pas par famille).
-- Le proche aidant peut être en "medical" pendant que le patient lui-même
-- est en "soft" → on stocke par family_members.user_id.
--
-- Valeurs :
--   medical  → données brutes, vocabulaire clinique, % et stats au premier plan
--   balanced → reformulation, chiffres présents mais contextualisés (default)
--   soft     → langage chaleureux, focus actions, stats en accordéon fermé

alter table public.family_members
  add column if not exists tone_preference text not null default 'balanced'
  check (tone_preference in ('medical', 'balanced', 'soft'));

comment on column public.family_members.tone_preference is
  'Tonalité d''affichage de l''app pour cet utilisateur. Adapte la copy et la hiérarchie visuelle, ne masque jamais l''info médicale critique.';
