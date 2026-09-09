-- Templates feature, part 2: reusable content presets. (Part 1, desk-scene
-- layouts, is a TypeScript config -- src/lib/packages/layouts.ts -- not a
-- DB table, since every layout is inseparable from a committed image and
-- adding one always requires a code change regardless of who's "admin".)
--
-- A preset is a named, admin-authored bundle of per-slot asset picks +
-- letter text a rep can apply when creating a package. Applying a preset
-- only pre-fills the create-package form client-side -- it creates no live
-- reference to the resulting package, so deleting a preset never affects
-- packages already created from it.

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id),
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  letter_body text,
  created_at timestamptz not null default now()
);

create table if not exists public.preset_assets (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.presets (id) on delete cascade,
  -- same slot vocabulary as package_assets.slot_name -- see PACKAGE_SLOTS
  slot_name text not null,
  asset_id uuid references public.assets (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (preset_id, slot_name)
);

create index if not exists idx_presets_org on public.presets (org_id);
create index if not exists idx_preset_assets_preset on public.preset_assets (preset_id);

alter table public.presets enable row level security;
alter table public.preset_assets enable row level security;

-- presets: any org member can read (reps pick from these); only an org
-- admin can write. Unlike assets (personal/company scope, owner-based
-- write RLS), presets have no owner concept -- entirely admin-authored
-- and org-wide -- so admin-only is enforced directly in RLS via
-- is_org_admin(), not just in the Server Action layer.
create policy "presets_select_org" on public.presets
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.org_id = presets.org_id
    )
  );

create policy "presets_insert_admin" on public.presets
  for insert with check (public.is_org_admin(org_id));

create policy "presets_update_admin" on public.presets
  for update using (public.is_org_admin(org_id));

create policy "presets_delete_admin" on public.presets
  for delete using (public.is_org_admin(org_id));

-- preset_assets: follow the parent preset's permissions (same shape as
-- package_assets_select / package_assets_write in 0001).
create policy "preset_assets_select" on public.preset_assets
  for select using (
    exists (
      select 1 from public.presets pr
      join public.profiles p on p.org_id = pr.org_id
      where pr.id = preset_assets.preset_id and p.id = auth.uid()
    )
  );

create policy "preset_assets_write" on public.preset_assets
  for all using (
    exists (
      select 1 from public.presets pr
      where pr.id = preset_assets.preset_id and public.is_org_admin(pr.org_id)
    )
  );
