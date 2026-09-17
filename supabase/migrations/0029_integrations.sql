create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  provider text not null check (
    provider in ('outlook', 'hubspot', 'autotask', 'connectwise', 'generic')
  ),
  status text not null default 'connected' check (
    status in ('connected', 'disconnected', 'error')
  ),
  -- AES-256-GCM encrypted by the app (src/lib/integrations/crypto.ts)
  -- before it ever reaches this column -- never stored in plaintext.
  encrypted_credentials text,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create table public.integration_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  provider_name text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.integrations enable row level security;
alter table public.integration_requests enable row level security;

-- Every org member can see their own org's connection status (not the
-- decrypted credentials themselves -- decryptCredentials only ever runs
-- server-side against the service-role client, never exposed via a
-- SELECT this policy grants to a browser session).
create policy "integrations_select_own_org" on public.integrations
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Only an org's own admin can connect/disconnect an integration.
create policy "integrations_write_admin" on public.integrations
  for all using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy "integration_requests_insert_own_org" on public.integration_requests
  for insert with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Only Securafy's own cross-tenant platform admins triage requests --
-- matches the existing is_platform_admin() pattern used by /admin (T12).
create policy "integration_requests_select_platform_admin" on public.integration_requests
  for select using (public.is_platform_admin());

create index idx_integrations_org on public.integrations (org_id);
create index idx_integration_requests_org on public.integration_requests (org_id);
