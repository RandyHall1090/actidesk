-- CRITICAL fix (2026-09-16 security audit): the INSERT and UPDATE policies
-- on assets/packages/presets validated only OWNERSHIP (created_by/owner_id
-- = auth.uid()), never TENANCY. Any authenticated user, in any org, could:
--   1. INSERT a row with org_id set to a DIFFERENT tenant's org (the
--      WITH CHECK had no org_id term at all), or
--   2. UPDATE a row they own and relabel its org_id into a different
--      tenant (UPDATE's WITH CHECK defaults to the USING clause when none
--      is specified, and USING also never referenced org_id).
-- For `packages` this means fabricating a fully attacker-controlled,
-- victim-org-branded page reachable at a real public /s/<slug> URL. Both
-- paths were confirmed exploitable live, in a rolled-back transaction,
-- during the audit.
--
-- is_own_org() mirrors is_org_admin()'s SECURITY DEFINER pattern (bypasses
-- profiles' own RLS to avoid the same recursion 0005 fixed) but drops the
-- role='admin' requirement, since these three tables allow any rep -- not
-- just admins -- to insert/update their own rows. This is the same fix
-- layouts_insert_admin/layouts_update_admin already get for free by using
-- is_org_admin(org_id), which happens to also re-validate tenancy.

create or replace function public.is_own_org(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and org_id = check_org_id
  );
$$;

revoke execute on function public.is_own_org(uuid) from public;
revoke execute on function public.is_own_org(uuid) from anon;
grant execute on function public.is_own_org(uuid) to authenticated;

-- assets: insert and update
drop policy "assets_insert_own" on public.assets;
create policy "assets_insert_own" on public.assets
  for insert with check (
    owner_id = auth.uid() and public.is_own_org(org_id)
  );

drop policy "assets_update_own_or_admin" on public.assets;
create policy "assets_update_own_or_admin" on public.assets
  for update using (
    owner_id = auth.uid() or public.is_org_admin(org_id)
  )
  with check (
    (owner_id = auth.uid() and public.is_own_org(org_id))
    or public.is_org_admin(org_id)
  );

-- packages: insert and update (owner-only, no admin branch -- unchanged
-- from prior behavior; packages_delete_own_or_admin already covers admin
-- delete separately, per migration 0023)
drop policy "packages_insert_own" on public.packages;
create policy "packages_insert_own" on public.packages
  for insert with check (
    created_by = auth.uid() and public.is_own_org(org_id)
  );

drop policy "packages_update_own" on public.packages;
create policy "packages_update_own" on public.packages
  for update using (
    created_by = auth.uid()
  )
  with check (
    created_by = auth.uid() and public.is_own_org(org_id)
  );

-- presets: insert and update
drop policy "presets_insert_own" on public.presets;
create policy "presets_insert_own" on public.presets
  for insert with check (
    created_by = auth.uid() and public.is_own_org(org_id)
  );

drop policy "presets_update_own_or_admin" on public.presets;
create policy "presets_update_own_or_admin" on public.presets
  for update using (
    created_by = auth.uid() or public.is_org_admin(org_id)
  )
  with check (
    (created_by = auth.uid() and public.is_own_org(org_id))
    or public.is_org_admin(org_id)
  );
