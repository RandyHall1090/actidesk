-- Outlook becomes a per-rep connection. The org-level row in
-- `integrations` (one Microsoft sign-in per org) meant every rep's contact
-- list and sent mail were really the connector's -- Graph /me/* runs as
-- whoever consented. See plans/2026-09-24-per-rep-outlook-and-in-outlook-
-- experience.md.

create table public.outlook_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  mailbox_email text not null,
  -- Graph /me id. Unique so one Microsoft mailbox can't be attached to two
  -- ActiDesk users -- the Outlook add-in maps a Microsoft sign-in back to a
  -- rep through this column.
  microsoft_user_id text not null unique,
  encrypted_credentials text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outlook_connections_org_id_idx on public.outlook_connections(org_id);

-- Holds a just-completed Microsoft sign-in for a few minutes until the rep's
-- own browser session claims it at /api/integrations/outlook/finish. The
-- callback runs on the registered redirect host, which usually isn't the
-- host the rep is signed in on, so it can't check the session itself.
create table public.outlook_connection_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  encrypted_payload text not null,
  created_at timestamptz not null default now()
);

-- Service-role only: RLS on with no policies, and no table grants to the
-- browser-facing roles either, so encrypted tokens are never selectable
-- from a client even if a policy is added by mistake later.
alter table public.outlook_connections enable row level security;
alter table public.outlook_connection_pending enable row level security;
revoke all on public.outlook_connections from anon, authenticated;
revoke all on public.outlook_connection_pending from anon, authenticated;

-- Retire the org-wide connection. Its owner reconnects from Account.
delete from public.integrations where provider = 'outlook';
