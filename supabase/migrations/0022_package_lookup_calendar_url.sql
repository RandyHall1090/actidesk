-- Return type is changing (new output column), so this needs a drop first --
-- CREATE OR REPLACE can't alter an existing function's OUT column list.
-- (Same pattern as 0012_package_lookup_org_branding.sql.)
drop function if exists public.get_package_by_slug(text);

create function public.get_package_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  prospect_name text,
  prospect_company text,
  letter_body text,
  template_id text,
  org_name text,
  org_logo_storage_path text,
  calendar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.slug, p.prospect_name, p.prospect_company, p.letter_body, p.template_id,
    o.name as org_name,
    (
      select a.storage_path from public.assets a
      where a.org_id = p.org_id and a.kind = 'logo' and a.scope = 'company'
      order by a.created_at desc
      limit 1
    ) as org_logo_storage_path,
    rep.calendar_url
  from public.packages p
  join public.orgs o on o.id = p.org_id
  join public.profiles rep on rep.id = p.created_by
  where p.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_package_by_slug(text) to anon, authenticated;
