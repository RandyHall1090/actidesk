-- A package can be deleted by the rep who created it, or by any admin in
-- that package's own org -- never a different tenant's admin, since
-- is_org_admin(org_id) checks the caller's own org_id against the row's.
-- Same own-or-admin pattern already established for presets (0019).
drop policy "packages_delete_own" on public.packages;
create policy "packages_delete_own_or_admin" on public.packages
  for delete using (
    created_by = auth.uid() or public.is_org_admin(org_id)
  );
