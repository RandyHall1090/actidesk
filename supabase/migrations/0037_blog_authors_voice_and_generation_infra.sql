-- Adds what the AI generation pipeline needs on top of the existing
-- blog_authors/blog_posts schema (0036): a slug (cron's ?authorSlug=
-- param), a voice_prompt (the author's SOP-style subject-ownership lens,
-- fed to the generation system prompt), and a per-author auto_publish
-- toggle -- this repo goes straight to the per-author shape Forge
-- University's own blog agent settled on (20260924_per_author_auto_publish
-- there superseded an earlier global singleton), not the now-obsolete
-- intermediate one.

alter table public.blog_authors
  add column slug text,
  add column voice_prompt text,
  add column active boolean not null default true,
  add column auto_publish boolean not null default false;

update public.blog_authors set slug = 'randy', voice_prompt =
  'Write from a business-strategy and ROI angle -- why investing in ' ||
  'sales-enablement tooling is a buying decision leadership actually ' ||
  'weighs, how personalized outbound is reshaping win rates and rep ' ||
  'productivity, and the executive case for standardizing on a shared ' ||
  'tool instead of ad hoc rep-by-rep approaches.'
  where email = 'rhall@securafy.com';

update public.blog_authors set slug = 'ric', voice_prompt =
  'Write from a procurement-and-accountability angle -- how a shared ' ||
  'outbound tool creates visibility into what reps are actually sending ' ||
  'and when, what governance and process discipline a sales leader needs ' ||
  'from their tooling, and the accountability case for standardizing ' ||
  'rep-facing tools instead of trusting spreadsheets and habits.'
  where email = 'Ric.Hall@Securafy.com';

update public.blog_authors set slug = 'jillian', voice_prompt =
  'Write from a demand-generation and marketing-systems angle -- how ' ||
  'personalized, trackable outbound content fits into a broader pipeline ' ||
  'strategy, what makes a prospect-facing asset actually get opened and ' ||
  'remembered, and how marketing and sales can share a single system ' ||
  'instead of working from disconnected materials.'
  where email = 'joco@securafy.com';

insert into public.blog_authors (name, title, email, focus_area, slug, voice_prompt)
values (
  'Rodney Hall',
  'COO',
  'rod.hall@securafy.com',
  'Sales-operations execution and outbound-program discipline',
  'rodney',
  'Write from an operations-and-execution angle on actually running an ' ||
  'outbound sales program -- day-to-day rep workflows, territory and ' ||
  'pipeline operations, tooling adoption and rollout mechanics, and the ' ||
  'operational discipline that makes personalized outbound work at ' ||
  'scale, not just strategy.'
);

alter table public.blog_authors alter column slug set not null;
alter table public.blog_authors add constraint blog_authors_slug_key unique (slug);

create table public.blog_generation_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failed')),
  post_id uuid references public.blog_posts(id) on delete set null,
  author_slug text,
  topic text,
  image_generated boolean not null default false,
  email_sent boolean not null default false,
  error_message text,
  model text
);

alter table public.blog_generation_runs enable row level security;
-- No policies -- service-role-only, matching blog_authors/blog_posts (0036).

insert into storage.buckets (id, name, public)
values ('blog-covers', 'blog-covers', true)
on conflict (id) do update set public = true;
