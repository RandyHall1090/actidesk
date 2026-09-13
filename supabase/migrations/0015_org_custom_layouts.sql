-- Org-scoped custom desk layouts (T15): lets any org's own admin save a
-- layout (positions + a real background image) directly from the Layout
-- Designer, no developer/deploy step needed -- unlike DESK_LAYOUTS in
-- src/lib/packages/layouts.ts, which stays a plain code array of the
-- Securafy-authored built-in layouts. A package's template_id now resolves
-- to either a built-in id ("desk-v1" etc.) or a row in this table.

create table if not exists public.layouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id),
  created_by uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  -- Already a ready-to-use <img src> value, exactly like DeskLayout.backgroundImage
  -- in code: either a fresh public Storage URL (a newly uploaded candidate
  -- image) or a literal /desk-scene/... app path (reusing an existing
  -- built-in background) -- no further resolution needed at read time.
  background_image text not null,
  aspect_ratio text not null,
  nameplate jsonb not null,
  slots jsonb not null,
  letter jsonb,
  brochures jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_layouts_org on public.layouts (org_id);

alter table public.layouts enable row level security;

create policy "layouts_select_org" on public.layouts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.org_id = layouts.org_id
    )
  );

create policy "layouts_insert_admin" on public.layouts
  for insert with check (public.is_org_admin(org_id));

create policy "layouts_update_admin" on public.layouts
  for update using (public.is_org_admin(org_id));

create policy "layouts_delete_admin" on public.layouts
  for delete using (public.is_org_admin(org_id));

-- The public /s/[slug] page (unauthenticated) needs to resolve exactly one
-- layout by its id without being an org member -- same reasoning as
-- get_package_by_slug (0004): a SECURITY DEFINER function that takes the
-- one id you already have (from the package's template_id) rather than a
-- blanket anon SELECT policy that would let anyone enumerate every org's
-- custom layouts via the REST API.
create or replace function public.get_layout_by_id(p_id uuid)
returns table (
  id uuid,
  label text,
  background_image text,
  aspect_ratio text,
  nameplate jsonb,
  slots jsonb,
  letter jsonb,
  brochures jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select id, label, background_image, aspect_ratio, nameplate, slots, letter, brochures
  from public.layouts
  where id = p_id
  limit 1;
$$;

revoke all on function public.get_layout_by_id(uuid) from public;
grant execute on function public.get_layout_by_id(uuid) to anon, authenticated;

-- Storage: a real bucket for uploaded background images (distinct from the
-- 'assets' bucket, which is private-by-default and keyed to the `assets`
-- table). Public read, since these render on the public unauthenticated
-- package page via a plain <img src> -- same "branding, not secret"
-- reasoning as company logos (0012). Write is restricted to that org's own
-- admin, enforced by requiring the object's own path to start with the
-- caller's org_id.
insert into storage.buckets (id, name, public)
values ('layout-backgrounds', 'layout-backgrounds', true)
on conflict (id) do nothing;

create policy "layout_backgrounds_insert_admin"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'layout-backgrounds'
  and public.is_org_admin(((storage.foldername(name))[1])::uuid)
);

create policy "layout_backgrounds_delete_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'layout-backgrounds'
  and public.is_org_admin(((storage.foldername(name))[1])::uuid)
);
