-- Public prospect pages resolve their assets through this SECURITY DEFINER
-- function, which previously joined any asset a package_assets row pointed
-- at. The package_assets write policy only checks who owns the package, not
-- the asset, so a hand-edited create/edit form could attach another org's
-- asset and publish it (Vimeo link, file, name) on a prospect page. The app
-- now validates attachments (src/lib/packages/slotAssets.ts); this is the
-- same rule enforced where the page actually reads, as defense in depth.
create or replace function public.get_package_assets_by_slug(p_slug text)
returns table(slot_name text, kind text, name text, storage_path text, external_url text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select pa.slot_name, a.kind, a.name, a.storage_path, a.external_url
  from public.package_assets pa
  join public.packages pk on pk.id = pa.package_id
  join public.assets a on a.id = pa.asset_id and a.org_id = pk.org_id
  where pk.slug = p_slug;
$function$;
