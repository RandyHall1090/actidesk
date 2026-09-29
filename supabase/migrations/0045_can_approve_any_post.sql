-- Same standing exception Forge University has: each blog author approves
-- only their own posts, except the one person with this flag, who may
-- approve or reject anyone's ("I need to be able to approve all blogs, but
-- only I can approve other author's blogs"). A narrow, purpose-specific
-- flag -- it overrides only that one blog restriction, nothing else.
alter table public.profiles
  add column can_approve_any_post boolean not null default false;

update public.profiles set can_approve_any_post = true where lower(email) = 'rhall@securafy.com';

-- profiles_update_own lets a user write their own row, so the flag must be
-- guarded like is_platform_admin: only the service role may change it.
create or replace function public.prevent_self_role_escalation()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_org_admin(old.org_id) then
    raise exception 'Only an admin can change a profile''s role';
  end if;

  if new.org_id is distinct from old.org_id then
    raise exception 'org_id cannot be changed';
  end if;

  if new.is_platform_admin is distinct from old.is_platform_admin then
    raise exception 'is_platform_admin cannot be changed here';
  end if;

  if new.can_approve_any_post is distinct from old.can_approve_any_post then
    raise exception 'can_approve_any_post cannot be changed here';
  end if;

  -- Supabase confirms a banned user's already-issued access token stays
  -- valid until it naturally expires (no way to force early revocation).
  -- Without this, a just-deactivated user with a still-live session could
  -- PATCH their own profiles row back to is_active = true via
  -- profiles_update_own before that token expires. old.id = auth.uid() is
  -- NULL (never true) for the service-role path above, so this never
  -- blocks a legitimate admin-initiated deactivation.
  if new.is_active is distinct from old.is_active and old.id = auth.uid() then
    raise exception 'You cannot change your own active status';
  end if;

  return new;
end;
$function$;
