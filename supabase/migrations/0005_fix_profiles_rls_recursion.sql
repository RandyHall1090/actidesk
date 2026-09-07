-- profiles_select_own_or_admin queried public.profiles from within its own
-- USING clause to check admin status. Postgres re-applies a table's RLS to
-- any reference to that same table, including from inside its own policy —
-- so that self-referential subquery recursed infinitely the moment anything
-- (a real logged-in user's own dashboard, or packages_select_org / etc,
-- which all join profiles) actually exercised RLS instead of bypassing it.
--
-- Fix: a SECURITY DEFINER function bypasses RLS on the table it queries
-- (it runs as the function owner, which owns the table), so checking admin
-- status through it breaks the cycle instead of re-triggering profiles' own
-- policy.

create or replace function public.is_org_admin(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and org_id = check_org_id
  );
$$;

grant execute on function public.is_org_admin(uuid) to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (
    id = auth.uid() or public.is_org_admin(org_id)
  );

drop policy if exists "assets_update_own_or_admin" on public.assets;
create policy "assets_update_own_or_admin" on public.assets
  for update using (
    owner_id = auth.uid() or public.is_org_admin(org_id)
  );

drop policy if exists "assets_delete_own_or_admin" on public.assets;
create policy "assets_delete_own_or_admin" on public.assets
  for delete using (
    owner_id = auth.uid() or public.is_org_admin(org_id)
  );
