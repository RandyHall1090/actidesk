-- Add an email column to profiles for display (auth.users isn't exposed via
-- PostgREST, so a Team admin page can't join against it directly).
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

-- SECURITY FIX: profiles_update_own only restricts which ROWS a rep can
-- update (their own), not which COLUMNS — meaning any rep could currently
-- set their own role to 'admin' via a plain PATCH to their own profile row.
-- RLS can't do column-level restriction on its own, so enforce it with a
-- trigger: only an actual admin may change a role (theirs or anyone else's).
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_org_admin(old.org_id) then
    raise exception 'Only an admin can change a profile''s role';
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_role_escalation on public.profiles;
create trigger prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- Admins also need an UPDATE policy to touch OTHER people's rows at all —
-- profiles_update_own only ever permitted id = auth.uid(). This new policy
-- is additive (OR'd with profiles_update_own); the trigger above is what
-- actually stops role escalation, not this policy by itself.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_org_admin(org_id));
