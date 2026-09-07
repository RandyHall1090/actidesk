-- Securafy Online Shock-and-Awe Portal — base schema (M1)
-- Run against a Supabase Postgres project: SQL Editor, or `supabase db push`
-- once this project is linked to a real Supabase project.
--
-- Single-org for v1 — org_id is a real column (not hardcoded in app code)
-- so adding a second org later is a data migration, not a schema rewrite.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  role text not null default 'rep' check (role in ('rep', 'admin')),
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null default 'personal' check (scope in ('personal', 'company')),
  kind text not null check (
    kind in ('video', 'audio', 'image', 'document', 'business_card', 'logo')
  ),
  name text not null,
  -- storage_path: a Supabase Storage path (images/documents/business cards).
  -- external_url: a Vimeo (or similar) link (video/audio) — see plan.md.
  storage_path text,
  external_url text,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint assets_has_a_location check (
    storage_path is not null or external_url is not null
  )
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  created_by uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique,
  prospect_name text not null,
  prospect_company text,
  prospect_email text,
  letter_body text,
  private_note text,
  template_id text not null default 'desk-v1',
  created_at timestamptz not null default now()
);

create table if not exists public.package_assets (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  -- e.g. 'video', 'audio', 'business_card', 'magazine', 'brochure_1' .. 'brochure_4'
  slot_name text not null,
  asset_id uuid references public.assets (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (package_id, slot_name)
);

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  event_type text not null check (
    event_type in ('page_view', 'asset_opened', 'asset_played')
  ),
  slot_name text,
  occurred_at timestamptz not null default now(),
  meta jsonb
);

create index if not exists idx_assets_org_scope on public.assets (org_id, scope);
create index if not exists idx_packages_org on public.packages (org_id);
create index if not exists idx_package_assets_package on public.package_assets (package_id);
create index if not exists idx_tracking_events_package on public.tracking_events (package_id);

-- Row Level Security ---------------------------------------------------

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.packages enable row level security;
alter table public.package_assets enable row level security;
alter table public.tracking_events enable row level security;

-- profiles: read your own row, or any row in your org if you're an admin
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = profiles.org_id
    )
  );

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- assets: read company-scope assets in your org, or your own personal ones;
-- only the owner (or an org admin) can write
create policy "assets_select_org" on public.assets
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.org_id = assets.org_id
    )
    and (scope = 'company' or owner_id = auth.uid())
  );

create policy "assets_insert_own" on public.assets
  for insert with check (owner_id = auth.uid());

create policy "assets_update_own_or_admin" on public.assets
  for update using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = assets.org_id
    )
  );

create policy "assets_delete_own_or_admin" on public.assets
  for delete using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = assets.org_id
    )
  );

-- packages: any org member can see all packages in the org; only the
-- creating rep can modify/delete their own
create policy "packages_select_org" on public.packages
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.org_id = packages.org_id
    )
  );

create policy "packages_insert_own" on public.packages
  for insert with check (created_by = auth.uid());

create policy "packages_update_own" on public.packages
  for update using (created_by = auth.uid());

create policy "packages_delete_own" on public.packages
  for delete using (created_by = auth.uid());

-- package_assets: follow the parent package's permissions
create policy "package_assets_select" on public.package_assets
  for select using (
    exists (
      select 1 from public.packages pk
      join public.profiles p on p.org_id = pk.org_id
      where pk.id = package_assets.package_id and p.id = auth.uid()
    )
  );

create policy "package_assets_write" on public.package_assets
  for all using (
    exists (
      select 1 from public.packages pk
      where pk.id = package_assets.package_id and pk.created_by = auth.uid()
    )
  );

-- tracking_events: the public /s/[slug] page runs unauthenticated (it's the
-- prospect's browser), so inserts are open; reads are restricted to the
-- package's org so only your own team sees engagement data
create policy "tracking_events_insert_public" on public.tracking_events
  for insert with check (true);

create policy "tracking_events_select_org" on public.tracking_events
  for select using (
    exists (
      select 1 from public.packages pk
      join public.profiles p on p.org_id = pk.org_id
      where pk.id = tracking_events.package_id and p.id = auth.uid()
    )
  );

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
