-- Real organizations table. Existing data already uses a single hardcoded
-- org_id everywhere (profiles/assets/packages) — backfilling that exact ID
-- as the real "Securafy" org means no data migration needed for it.
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Domain used to match self-service "join an existing company" signups.
  -- One domain per org for v1 — a company with multiple domains is a
  -- known limitation, not something to solve until it's a real request.
  email_domain text not null unique,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

insert into public.orgs (id, name, email_domain, created_at)
values ('00000000-0000-0000-0000-000000000001', 'Securafy', 'securafy.com', now())
on conflict (id) do nothing;

alter table public.profiles
  add constraint profiles_org_id_fkey foreign key (org_id) references public.orgs (id),
  alter column org_id drop default;

alter table public.assets
  add constraint assets_org_id_fkey foreign key (org_id) references public.orgs (id),
  alter column org_id drop default;

alter table public.packages
  add constraint packages_org_id_fkey foreign key (org_id) references public.orgs (id),
  alter column org_id drop default;

alter table public.orgs enable row level security;

-- A member can read their own org (for displaying name/logo in the UI).
create policy "orgs_select_member" on public.orgs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and org_id = orgs.id)
  );

-- Self-service org creation happens through complete_signup() below, not a
-- direct insert — but that function still runs as the calling user for
-- auth.uid() purposes, so it still needs a policy permitting the insert.
create policy "orgs_insert_self" on public.orgs
  for insert with check (created_by = auth.uid());

create policy "orgs_update_admin" on public.orgs
  for update using (public.is_org_admin(id));

-- Old auto-profile-creation trigger is replaced by the explicit
-- create-or-join flow below (a bare trigger can't ask "new company or
-- join an existing one?" — that's a real decision the signup UI makes).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Narrow, public-safe lookup used by the signup page before the user has
-- any session/profile: "does a company already exist for this email
-- domain?" Returns only a name — never membership, assets, or anything
-- else about that org.
create or replace function public.find_org_by_email_domain(p_email text)
returns table (org_id uuid, org_name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, name from public.orgs
  where email_domain = lower(split_part(p_email, '@', 2));
$$;

grant execute on function public.find_org_by_email_domain(text) to anon, authenticated;

-- Encapsulates the actual create-or-join decision atomically, server-side,
-- so a client can never fabricate its own role or org_id. The org's
-- creator becomes admin; everyone who joins an existing org becomes rep —
-- that's enforced here, not trusted from the caller.
create or replace function public.complete_signup(
  p_action text,
  p_company_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_domain text;
  v_org_id uuid;
  v_role text;
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile already exists';
  end if;

  select email into v_email from auth.users where id = v_user_id;
  v_domain := lower(split_part(v_email, '@', 2));

  if p_action = 'create' then
    if p_company_name is null or length(trim(p_company_name)) = 0 then
      raise exception 'Company name is required';
    end if;
    if exists (select 1 from public.orgs where email_domain = v_domain) then
      raise exception 'An organization already exists for this email domain';
    end if;
    insert into public.orgs (name, email_domain, created_by)
    values (trim(p_company_name), v_domain, v_user_id)
    returning id into v_org_id;
    v_role := 'admin';
  elsif p_action = 'join' then
    select id into v_org_id from public.orgs where email_domain = v_domain;
    if v_org_id is null then
      raise exception 'No organization found for this email domain';
    end if;
    v_role := 'rep';
  else
    raise exception 'Invalid action: %', p_action;
  end if;

  insert into public.profiles (id, org_id, role, email)
  values (v_user_id, v_org_id, v_role, v_email)
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.complete_signup(text, text) to authenticated;
revoke execute on function public.complete_signup(text, text) from public, anon;
