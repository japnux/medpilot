-- =====================================================================
-- MedPilot — Module Medication, Lot 2 (Visibility & education)
-- - Colonnes URLs officielles + effets indésirables connus sur medications
-- - Table medication_references : lookup oncologie + support, lecture publique
-- - Seed ~35 médicaments courants (oncologie, endocrino, antalgiques…)
-- =====================================================================

-- Lot 2.1 : enrichissement de medications
alter table public.medications
  add column if not exists wikipedia_url text,
  add column if not exists vidal_url text,
  add column if not exists ansm_url text,
  add column if not exists known_side_effects text;

-- Lot 2.2 : table de référence (lookup pour autocomplete + prefill)
create table if not exists public.medication_references (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- DCI ou nom courant
  brand_name text,                          -- Marque principale
  active_ingredient text,                   -- DCI si name != DCI
  category text,                            -- "chimio", "immuno", "hormono", "support", "endocrino"
  default_indication text,
  wikipedia_url text,
  vidal_url text,
  ansm_url text,
  common_side_effects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Index recherche (lower-cased prefix match)
create index if not exists idx_medication_references_name_lower
  on public.medication_references (lower(name));
create index if not exists idx_medication_references_brand_lower
  on public.medication_references (lower(brand_name));

-- Pas de RLS : table publique en lecture. Aucune politique d'INSERT/UPDATE/DELETE
-- côté client : géré par migration uniquement.
alter table public.medication_references enable row level security;

drop policy if exists "medication_references_public_read" on public.medication_references;
create policy "medication_references_public_read" on public.medication_references
  for select using (true);

-- =====================================================================
-- Seed : médicaments oncologiques courants + soins de support
-- =====================================================================

insert into public.medication_references
  (name, brand_name, active_ingredient, category, default_indication, wikipedia_url, common_side_effects)
values
  -- Corticosurrénalome / endocrinologie
  ('Mitotane', 'Lysodren', 'mitotane', 'chimio', 'Corticosurrénalome (adjuvant ou avancé)',
   'https://fr.wikipedia.org/wiki/Mitotane',
   '["Nausées","Diarrhée","Anorexie","Fatigue","Vertiges","Ataxie","Insuffisance surrénalienne","Hypercholestérolémie","Toxicité hépatique"]'::jsonb),
  ('Hydrocortisone', 'Hydrocortisone Upjohn', 'hydrocortisone', 'endocrino', 'Substitution surrénalienne',
   'https://fr.wikipedia.org/wiki/Hydrocortisone',
   '["Prise de poids","Rétention hydrique","Insomnie","Variations glycémie","Risque infectieux si surdosage"]'::jsonb),
  ('Fludrocortisone', 'Flucortac', 'fludrocortisone', 'endocrino', 'Substitution minéralocorticoïde',
   'https://fr.wikipedia.org/wiki/Fludrocortisone',
   '["Hypokaliémie","Hypertension","Œdèmes"]'::jsonb),
  ('Lévothyroxine', 'Levothyrox', 'lévothyroxine', 'endocrino', 'Substitution thyroïdienne',
   'https://fr.wikipedia.org/wiki/L%C3%A9vothyroxine',
   '["Palpitations","Insomnie","Perte de poids","Sueurs"]'::jsonb),

  -- Chimiothérapies cytotoxiques
  ('Étoposide', 'Vepeside', 'étoposide', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/%C3%89toposide',
   '["Myélosuppression","Alopécie","Nausées","Mucite","Hypotension à perfusion rapide"]'::jsonb),
  ('Doxorubicine', 'Adriblastine', 'doxorubicine', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/Doxorubicine',
   '["Myélosuppression","Cardiotoxicité","Alopécie","Mucite","Coloration rouge des urines"]'::jsonb),
  ('Cisplatine', 'Cisplatyl', 'cisplatine', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/Cisplatine',
   '["Néphrotoxicité","Ototoxicité","Neuropathie","Nausées sévères","Myélosuppression"]'::jsonb),
  ('Carboplatine', 'Carboplatine', 'carboplatine', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/Carboplatine',
   '["Myélosuppression (thrombopénie)","Nausées","Neuropathie","Néphrotoxicité (moindre que cisplatine)"]'::jsonb),
  ('Streptozotocine', 'Zanosar', 'streptozotocine', 'chimio', 'Tumeurs neuroendocrines',
   'https://fr.wikipedia.org/wiki/Streptozotocine',
   '["Néphrotoxicité","Nausées","Hyperglycémie","Hépatotoxicité"]'::jsonb),
  ('Paclitaxel', 'Taxol', 'paclitaxel', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/Paclitaxel',
   '["Neuropathie périphérique","Myélosuppression","Alopécie","Réactions d''hypersensibilité"]'::jsonb),
  ('Cyclophosphamide', 'Endoxan', 'cyclophosphamide', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/Cyclophosphamide',
   '["Myélosuppression","Cystite hémorragique","Nausées","Alopécie","Risque de stérilité"]'::jsonb),
  ('5-Fluorouracile', '5-FU', '5-fluorouracile', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/Fluorouracile',
   '["Mucite","Diarrhée","Syndrome main-pied","Myélosuppression","Toxicité cardiaque rare"]'::jsonb),
  ('Capécitabine', 'Xeloda', 'capécitabine', 'chimio', 'Chimiothérapie cytotoxique orale',
   'https://fr.wikipedia.org/wiki/Cap%C3%A9citabine',
   '["Syndrome main-pied","Diarrhée","Mucite","Nausées"]'::jsonb),
  ('Gemcitabine', 'Gemzar', 'gemcitabine', 'chimio', 'Chimiothérapie cytotoxique',
   'https://fr.wikipedia.org/wiki/Gemcitabine',
   '["Myélosuppression","Syndrome pseudo-grippal","Œdèmes","Élévation transaminases"]'::jsonb),

  -- Thérapies ciblées
  ('Pazopanib', 'Votrient', 'pazopanib', 'ciblee', 'Inhibiteur de tyrosine kinase',
   'https://fr.wikipedia.org/wiki/Pazopanib',
   '["Hypertension","Hépatotoxicité","Diarrhée","Fatigue","Hypothyroïdie"]'::jsonb),
  ('Sunitinib', 'Sutent', 'sunitinib', 'ciblee', 'Inhibiteur de tyrosine kinase',
   'https://fr.wikipedia.org/wiki/Sunitinib',
   '["Hypertension","Hypothyroïdie","Fatigue","Syndrome main-pied","Mucite"]'::jsonb),
  ('Cabozantinib', 'Cabometyx', 'cabozantinib', 'ciblee', 'Inhibiteur multi-kinase',
   'https://fr.wikipedia.org/wiki/Cabozantinib',
   '["Diarrhée","Hypertension","Fatigue","Syndrome main-pied"]'::jsonb),

  -- Immunothérapies
  ('Pembrolizumab', 'Keytruda', 'pembrolizumab', 'immuno', 'Anti-PD-1',
   'https://fr.wikipedia.org/wiki/Pembrolizumab',
   '["Fatigue","Toxicités immunologiques (thyroïde, hypophyse, colite, pneumonite, hépatite)","Prurit"]'::jsonb),
  ('Nivolumab', 'Opdivo', 'nivolumab', 'immuno', 'Anti-PD-1',
   'https://fr.wikipedia.org/wiki/Nivolumab',
   '["Fatigue","Toxicités immunologiques (thyroïde, colite, pneumonite, hépatite)","Rash"]'::jsonb),
  ('Ipilimumab', 'Yervoy', 'ipilimumab', 'immuno', 'Anti-CTLA-4',
   'https://fr.wikipedia.org/wiki/Ipilimumab',
   '["Colite immune","Hypophysite","Hépatite immune","Rash","Fatigue"]'::jsonb),

  -- Hormonothérapie
  ('Tamoxifène', 'Nolvadex', 'tamoxifène', 'hormono', 'Hormonothérapie sein',
   'https://fr.wikipedia.org/wiki/Tamoxif%C3%A8ne',
   '["Bouffées de chaleur","Thrombose veineuse","Risque endométrial","Sécheresse vaginale"]'::jsonb),
  ('Létrozole', 'Femara', 'létrozole', 'hormono', 'Inhibiteur aromatase',
   'https://fr.wikipedia.org/wiki/L%C3%A9trozole',
   '["Bouffées de chaleur","Arthralgies","Ostéoporose","Fatigue"]'::jsonb),
  ('Anastrozole', 'Arimidex', 'anastrozole', 'hormono', 'Inhibiteur aromatase',
   'https://fr.wikipedia.org/wiki/Anastrozole',
   '["Bouffées de chaleur","Arthralgies","Ostéoporose","Fatigue"]'::jsonb),

  -- Anti-émétiques / soins de support
  ('Ondansétron', 'Zophren', 'ondansétron', 'support', 'Anti-émétique 5-HT3',
   'https://fr.wikipedia.org/wiki/Ondans%C3%A9tron',
   '["Constipation","Céphalées","Allongement QT"]'::jsonb),
  ('Métoclopramide', 'Primperan', 'métoclopramide', 'support', 'Anti-émétique',
   'https://fr.wikipedia.org/wiki/M%C3%A9toclopramide',
   '["Somnolence","Syndrome extrapyramidal (rare)","Diarrhée"]'::jsonb),
  ('Dompéridone', 'Motilium', 'dompéridone', 'support', 'Anti-émétique',
   'https://fr.wikipedia.org/wiki/Domp%C3%A9ridone',
   '["Allongement QT","Sécheresse buccale"]'::jsonb),
  ('Aprépitant', 'Emend', 'aprépitant', 'support', 'Anti-émétique NK1',
   'https://fr.wikipedia.org/wiki/Apr%C3%A9pitant',
   '["Fatigue","Hoquet","Constipation"]'::jsonb),

  -- Antalgiques
  ('Paracétamol', 'Doliprane', 'paracétamol', 'support', 'Antalgique de palier 1',
   'https://fr.wikipedia.org/wiki/Parac%C3%A9tamol',
   '["Hépatotoxicité si surdosage"]'::jsonb),
  ('Tramadol', 'Topalgic', 'tramadol', 'support', 'Antalgique de palier 2',
   'https://fr.wikipedia.org/wiki/Tramadol',
   '["Nausées","Vertiges","Constipation","Somnolence","Risque sérotoninergique"]'::jsonb),
  ('Morphine', 'Skenan', 'morphine', 'support', 'Antalgique opioïde fort',
   'https://fr.wikipedia.org/wiki/Morphine',
   '["Constipation","Somnolence","Nausées","Confusion","Dépression respiratoire à fortes doses"]'::jsonb),
  ('Oxycodone', 'Oxycontin', 'oxycodone', 'support', 'Antalgique opioïde fort',
   'https://fr.wikipedia.org/wiki/Oxycodone',
   '["Constipation","Somnolence","Nausées","Confusion"]'::jsonb),

  -- Gastro / divers
  ('Pantoprazole', 'Eupantol', 'pantoprazole', 'support', 'IPP gastroprotection',
   'https://fr.wikipedia.org/wiki/Pantoprazole',
   '["Céphalées","Diarrhée","Carences (B12, fer, magnésium) au long cours"]'::jsonb),
  ('Oméprazole', 'Mopral', 'oméprazole', 'support', 'IPP gastroprotection',
   'https://fr.wikipedia.org/wiki/Om%C3%A9prazole',
   '["Céphalées","Diarrhée","Carences (B12, fer, magnésium) au long cours"]'::jsonb),

  -- Statines
  ('Atorvastatine', 'Tahor', 'atorvastatine', 'support', 'Hypocholestérolémiant',
   'https://fr.wikipedia.org/wiki/Atorvastatine',
   '["Myalgies","Élévation transaminases","Rhabdomyolyse (rare)"]'::jsonb),
  ('Pravastatine', 'Elisor', 'pravastatine', 'support', 'Hypocholestérolémiant',
   'https://fr.wikipedia.org/wiki/Pravastatine',
   '["Myalgies","Élévation transaminases"]'::jsonb),
  ('Rosuvastatine', 'Crestor', 'rosuvastatine', 'support', 'Hypocholestérolémiant',
   'https://fr.wikipedia.org/wiki/Rosuvastatine',
   '["Myalgies","Élévation transaminases"]'::jsonb)
on conflict do nothing;
