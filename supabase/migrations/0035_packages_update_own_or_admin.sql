-- packages_update_own (0001) never let an org admin edit a package a
-- different rep created -- only DELETE had the "own or admin" pattern
-- already established for assets_update_own_or_admin and
-- presets_update_own_or_admin (both migration 0024). Brings packages'
-- UPDATE policy in line with that same, already-audited pattern: an
-- admin can update any package in their own org; a non-admin still only
-- their own, and still can't smuggle a different org_id onto their own
-- row via is_own_org in with_check.
drop policy "packages_update_own" on public.packages;

create policy "packages_update_own_or_admin" on public.packages
  for update
  using (created_by = auth.uid() OR is_org_admin(org_id))
  with check ((created_by = auth.uid() AND is_own_org(org_id)) OR is_org_admin(org_id));
