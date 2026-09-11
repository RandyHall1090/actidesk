-- Platform admin capability (Securafy staff, cross-tenant support access)
-- and the user lifecycle columns needed for admin-managed accounts:
-- is_active (deactivate/reactivate without deleting) and is_platform_admin
-- (orthogonal to the existing per-org role='admin' -- a platform admin
-- keeps their normal role too, so every existing role==='admin' gate
-- across the app keeps working unchanged for their own org; the new
-- cross-tenant Admin surface is gated purely on is_platform_admin).

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists is_platform_admin boolean not null default false;

alter table public.profiles
  add constraint profiles_platform_admin_only_securafy
    check (not is_platform_admin or org_id = '00000000-0000-0000-0000-000000000001');

-- Mirrors is_org_admin()'s exact shape/lockdown convention (0005/0006/0007).
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_platform_admin = true
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;
revoke execute on function public.is_platform_admin() from public, anon;

-- prevent_self_role_escalation(): every write this feature needs (create
-- user, reset password, deactivate/reactivate, cross-tenant role change,
-- platform-admin grant/revoke) goes through the service-role client
-- (src/lib/supabase/admin.ts), whose JWT carries role: 'service_role' as a
-- claim readable via auth.role() -- unlike current_user/session_user,
-- which SECURITY DEFINER substitutes to the function owner regardless of
-- caller, so those can't be used to recognize it. Every one of those call
-- sites already ran its own is_org_admin()/is_platform_admin() check in
-- the calling Server Action before reaching the database, and the
-- service-role key itself is never exposed to a browser, so trusting it
-- wholesale here is safe. The profiles_platform_admin_only_securafy CHECK
-- constraint above is the real, un-bypassable-even-by-service-role
-- backstop against a bad is_platform_admin write, not this trigger.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_org_admin(old.org_id) then
    raise exception 'Only an admin can change a profile''s role';
  end if;

  if new.org_id is distinct from old.org_id then
    raise exception 'org_id cannot be changed';
  end if;

  if new.is_platform_admin is distinct from old.is_platform_admin then
    raise exception 'is_platform_admin cannot be changed here';
  end if;

  -- Supabase confirms a banned user's already-issued access token stays
  -- valid until it naturally expires (no way to force early revocation).
  -- Without this, a just-deactivated user with a still-live session could
  -- PATCH their own profiles row back to is_active = true via
  -- profiles_update_own before that token expires. old.id = auth.uid() is
  -- NULL (never true) for the service-role path above, so this never
  -- blocks a legitimate admin-initiated deactivation.
  if new.is_active is distinct from old.is_active and old.id = auth.uid() then
    raise exception 'You cannot change your own active status';
  end if;

  return new;
end;
$$;

-- SELECT-side RLS: let a platform admin browse cross-tenant for support.
-- Writes deliberately are NOT extended here -- every write this feature
-- needs goes through the service-role client above, which bypasses RLS
-- entirely, so no UPDATE/INSERT policy changes are needed at all.
-- presets/preset_assets are explicitly left untouched (out of scope for
-- now, trivial to extend the same way later).

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (
    id = auth.uid() or public.is_org_admin(org_id) or public.is_platform_admin()
  );

drop policy if exists "orgs_select_member" on public.orgs;
create policy "orgs_select_member" on public.orgs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and org_id = orgs.id)
    or public.is_platform_admin()
  );

drop policy if exists "packages_select_org" on public.packages;
create policy "packages_select_org" on public.packages
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = packages.org_id)
    or public.is_platform_admin()
  );

drop policy if exists "package_assets_select" on public.package_assets;
create policy "package_assets_select" on public.package_assets
  for select using (
    exists (
      select 1 from public.packages pk
      join public.profiles p on p.org_id = pk.org_id
      where pk.id = package_assets.package_id and p.id = auth.uid()
    )
    or public.is_platform_admin()
  );

drop policy if exists "assets_select_org" on public.assets;
create policy "assets_select_org" on public.assets
  for select using (
    (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = assets.org_id)
      and (scope = 'company' or owner_id = auth.uid())
    )
    or public.is_platform_admin()
  );

drop policy if exists "tracking_events_select_org" on public.tracking_events;
create policy "tracking_events_select_org" on public.tracking_events
  for select using (
    exists (
      select 1 from public.packages pk
      join public.profiles p on p.org_id = pk.org_id
      where pk.id = tracking_events.package_id and p.id = auth.uid()
    )
    or public.is_platform_admin()
  );
