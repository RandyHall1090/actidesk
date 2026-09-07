-- The public /s/[slug] page is unauthenticated (it's the prospect's
-- browser). It must be able to look up exactly one package by its exact
-- slug, and read the storage-backed assets attached to it — but must NOT
-- be able to browse/enumerate packages or assets in general.
--
-- We deliberately do NOT add a blanket anon SELECT policy on packages or
-- package_assets: with RLS, "using (true)" for anon would let anyone with
-- the (public) anon key list every package via the REST API regardless of
-- what they filter by, not just the one they asked for. SECURITY DEFINER
-- functions that take the slug as a parameter and return at most one row
-- avoid that: a wrong or missing slug returns nothing, and there is no way
-- to browse without already knowing an exact slug.

create or replace function public.get_package_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  prospect_name text,
  prospect_company text,
  letter_body text,
  template_id text
)
language sql
security definer
set search_path = public
stable
as $$
  select id, slug, prospect_name, prospect_company, letter_body, template_id
  from public.packages
  where slug = p_slug
  limit 1;
$$;

grant execute on function public.get_package_by_slug(text) to anon, authenticated;

create or replace function public.get_package_assets_by_slug(p_slug text)
returns table (
  slot_name text,
  kind text,
  name text,
  storage_path text,
  external_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select pa.slot_name, a.kind, a.name, a.storage_path, a.external_url
  from public.package_assets pa
  join public.packages pk on pk.id = pa.package_id
  join public.assets a on a.id = pa.asset_id
  where pk.slug = p_slug;
$$;

grant execute on function public.get_package_assets_by_slug(text) to anon, authenticated;

-- Storage RLS: anon may read (and therefore generate a signed URL for) an
-- object only if it is actually attached to at least one package — i.e.
-- only once a rep has included it in something sent to a prospect. Assets
-- sitting unused in a library stay unreadable to anon.
create policy "assets_storage_select_public_via_package"
on storage.objects for select
to anon
using (
  bucket_id = 'assets'
  and exists (
    select 1
    from public.assets a
    join public.package_assets pa on pa.asset_id = a.id
    where a.storage_path = storage.objects.name
  )
);
