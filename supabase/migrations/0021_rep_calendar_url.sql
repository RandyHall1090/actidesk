-- A rep's own meeting-scheduling link (Calendly, Cal.com, HubSpot Meetings,
-- or anything else) -- shown as a CTA on packages that rep creates. Plain
-- rep-entered URL, not a provider-specific integration, since this app is
-- multi-tenant and no single connected scheduling account would generalize
-- across every tenant's reps. See spec/plan.md T32.
alter table public.profiles add column if not exists calendar_url text;
