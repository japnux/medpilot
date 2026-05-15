-- Fix : le créateur d'une famille doit pouvoir la lire/maj avant que la
-- rangée family_members associée soit insérée.
--
-- Sans ce fix, `insert().select().single()` sur families renvoie 0 row
-- (la policy SELECT initiale exigeait public.is_family_member(id) qui est
-- forcément false au moment de l'insert tout frais → onboarding cassé en 403).

drop policy if exists "families_select_members" on public.families;
create policy "families_select_members" on public.families
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_family_member(id)
  );

drop policy if exists "families_update_admin" on public.families;
create policy "families_update_admin" on public.families
  for update to authenticated
  using (
    created_by = auth.uid()
    or public.is_family_admin(id)
  )
  with check (
    created_by = auth.uid()
    or public.is_family_admin(id)
  );
