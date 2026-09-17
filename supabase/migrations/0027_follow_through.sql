-- T38: automated follow-through. All eligibility/creation/notification
-- logic lives in app code (src/app/api/cron/follow-through/route.ts),
-- matching how the rest of this app keeps "smart" logic in TypeScript,
-- not deep in Postgres functions -- pg_cron here only fires a daily,
-- authenticated POST to that route via pg_net.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

alter table public.orgs
  add column follow_up_enabled boolean not null default false,
  add column follow_up_days integer not null default 5;

-- Points a generated follow-up package back at the original it followed
-- up on. Also doubles as the "already followed up on this one" guard --
-- the eligibility query checks no package exists with follow_up_of
-- pointing at a given original before generating another.
alter table public.packages
  add column follow_up_of uuid references public.packages (id) on delete set null;

create index idx_packages_follow_up_of on public.packages (follow_up_of);

-- NOTE: the URL and secret below are literal values, not env-var
-- references -- pg_cron/pg_net run entirely inside Postgres and have no
-- access to Vercel's environment variables. If the deployed domain ever
-- changes (see the pending ActiDesk infra-rename decision), this job
-- needs re-scheduling with the new URL (cron.unschedule + cron.schedule
-- again, not an in-place edit -- pg_cron has no "alter job URL").
--
-- The real secret is intentionally NOT committed here -- this file's
-- <CRON_SECRET> placeholder was substituted with the real generated
-- value only in the live database (via a direct, uncommitted
-- apply_migration call), matching how every other real secret in this
-- app stays out of git (GATE_DESK_API_KEY, RESEND_API_KEY, etc.). The
-- same real value must also be set as CRON_SECRET in .env.local/Vercel
-- so the route in Task below can verify the header matches.
select cron.schedule(
  'follow-through-daily',
  '0 13 * * *', -- 1pm UTC daily
  $$
  select net.http_post(
    url := 'https://securafy-shock-and-awe.vercel.app/api/cron/follow-through',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
