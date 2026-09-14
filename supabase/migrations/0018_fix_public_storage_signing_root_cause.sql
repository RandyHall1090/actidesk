-- Root cause of the "brochures/documents don't render for a real
-- anonymous visitor" bug that migrations 0016/0017 partially uncovered.
--
-- Even after granting anon EXECUTE on is_org_admin/is_platform_admin, a
-- clean cookie-less anon-key call to Storage's sign endpoint for a real,
-- existing object still returned 404 "Object not found". The two
-- anon-scoped storage.objects SELECT policies (assets_storage_select_
-- public_via_package, assets_storage_select_public_logo) each subquery
-- `public.assets` / `public.package_assets` directly -- but those tables
-- have no SELECT policy that an anon role can ever satisfy: every
-- existing policy on them requires a real auth.uid() match (always null
-- for anon) or is_platform_admin() (now safely callable, but still false
-- for anon). So the storage policies' subqueries always returned zero
-- rows for anon, regardless of whether the object was really attached to
-- a package -- the signing call always failed, for every tenant, since
-- the day these tables' RLS was written.
--
-- Fixed the same way this codebase already solves "expose exactly one
-- narrow public fact without a blanket table-level SELECT grant that
-- would let PostgREST/Storage enumerate the whole table" elsewhere
-- (get_package_by_slug, get_package_assets_by_slug, get_layout_by_id):
-- a SECURITY DEFINER function that checks the one specific fact the
-- storage policy needs (this storage path is attached to *some*
-- package / is a company logo) and returns only a boolean, bypassing
-- assets/package_assets's row-level RLS as the function owner. This is
-- not a new information disclosure: it exposes strictly less than the
-- table's own SELECT policies already do for their allowed roles, and
-- nothing enumerable -- a caller still needs a real storage path (an
-- unguessable UUID-derived key) to get anything back.
create or replace function public.asset_public_via_package(p_storage_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.assets a
    join public.package_assets pa on pa.asset_id = a.id
    where a.storage_path = p_storage_path
  );
$$;

revoke all on function public.asset_public_via_package(text) from public;
grant execute on function public.asset_public_via_package(text) to anon, authenticated;

create or replace function public.asset_public_company_logo(p_storage_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.assets a
    where a.storage_path = p_storage_path
      and a.kind = 'logo'
      and a.scope = 'company'
  );
$$;

revoke all on function public.asset_public_company_logo(text) from public;
grant execute on function public.asset_public_company_logo(text) to anon, authenticated;

drop policy if exists "assets_storage_select_public_via_package" on storage.objects;
create policy "assets_storage_select_public_via_package"
on storage.objects for select
to anon
using (
  bucket_id = 'assets'
  and public.asset_public_via_package(name)
);

drop policy if exists "assets_storage_select_public_logo" on storage.objects;
create policy "assets_storage_select_public_logo"
on storage.objects for select
to anon
using (
  bucket_id = 'assets'
  and public.asset_public_company_logo(name)
);
