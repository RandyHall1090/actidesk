-- T34: billing state for orgs. billing_tier (added here, superseding the
-- original single-STRIPE_PRICE_ID plan) tracks which of the 3 named
-- Stripe Products (Solo/Team/Business) an org is subscribed to -- see
-- plans/2026-09-17-t34-stripe-billing.md for the real Product/Price IDs.
alter table public.orgs
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column subscription_status text not null default 'trialing',
  add column billing_tier text,
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column billing_exempt boolean not null default false;

alter table public.orgs
  add constraint orgs_subscription_status_check
  check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));

alter table public.orgs
  add constraint orgs_billing_tier_check
  check (billing_tier is null or billing_tier in ('solo', 'team', 'business'));

-- Nullable but unique when present -- Postgres partial unique indexes treat
-- NULL as distinct, so many orgs can share "no customer yet" with no conflict.
create unique index orgs_stripe_customer_id_idx
  on public.orgs (stripe_customer_id) where stripe_customer_id is not null;
create unique index orgs_stripe_subscription_id_idx
  on public.orgs (stripe_subscription_id) where stripe_subscription_id is not null;

-- Securafy is the platform operator, not a paying customer -- permanently
-- exempt, set once here and never touched by any webhook/billing code path.
-- billing_tier stays NULL for this org: "exempt" isn't a tier it's paying
-- for, it's a permanent bypass of the whole billing system.
update public.orgs
set billing_exempt = true, subscription_status = 'active'
where id = '00000000-0000-0000-0000-000000000001';
