-- Return type is changing (new output columns), so this needs a drop first —
-- CREATE OR REPLACE can't alter an existing function's OUT column list.
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
  org_logo_storage_path text
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
    ) as org_logo_storage_path
  from public.packages p
  join public.orgs o on o.id = p.org_id
  where p.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_package_by_slug(text) to anon, authenticated;

-- A company logo is branding, not secret — meant to be seen by anyone
-- viewing that company's packages. Public read for any logo-kind,
-- company-scope asset (paths are unguessable UUIDs regardless).
create policy "assets_storage_select_public_logo"
on storage.objects for select
to anon
using (
  bucket_id = 'assets'
  and exists (
    select 1 from public.assets a
    where a.storage_path = storage.objects.name
      and a.kind = 'logo'
      and a.scope = 'company'
  )
);
