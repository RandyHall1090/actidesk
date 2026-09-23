-- Blog subsystem schema. Deliberately NOT org_id-scoped: every other table
-- in this repo is per-tenant (org_id + RLS), but the blog is a platform-wide
-- marketing feature about the product itself, not a per-tenant customer
-- feature. RLS enabled with zero policies (service-role only), matching
-- every sibling property's own blog tables (Forge University, ActiForge,
-- ActiScan) -- all admin access goes through createAdminClient(), same as
-- this repo's existing platform-admin Server Actions.

create table public.blog_authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  email text not null,
  focus_area text not null,
  created_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  seo_title text,
  slug text not null unique,
  excerpt text not null,
  meta_description text,
  image_alt_text text,
  content text not null,
  cover_image_url text,
  author_id uuid references public.blog_authors(id),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index blog_posts_status_idx on public.blog_posts(status);
create index blog_posts_author_id_idx on public.blog_posts(author_id);
create index blog_posts_published_at_idx on public.blog_posts(published_at);

alter table public.blog_authors enable row level security;
alter table public.blog_posts enable row level security;
-- No policies on either -- service-role-only access, same as every
-- sibling property's blog tables.
