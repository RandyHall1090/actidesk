-- MEDIUM fix (2026-09-16 security audit): tracking_events_insert_public
-- was `with check (true)` -- any caller (anon included, using nothing but
-- the public anon key) could INSERT a tracking row for ANY existing
-- package_id, not just the one on the /s/[slug] page they're actually
-- viewing, with an unconstrained free-text slot_name and no rate limiting.
-- That let anyone forge fake engagement events on someone else's package
-- (own org or otherwise) or flood a package's Activity log.
--
-- Fix: route all inserts through a slug-scoped SECURITY DEFINER RPC that
-- resolves package_id from the slug server-side (the same "know the exact
-- slug" boundary that already gates reading the page itself, per 0004),
-- caps slot_name length, and validates event_type -- then drop the open
-- table-level INSERT policy entirely so a direct REST insert (bypassing
-- the RPC) is denied by RLS with no replacement policy to fall back on.

create or replace function public.record_tracking_event(
  p_slug text,
  p_event_type text,
  p_slot_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package_id uuid;
begin
  select id into v_package_id from public.packages where slug = p_slug limit 1;
  if v_package_id is null then
    return; -- unknown slug -- silently no-op, matches this beacon's fire-and-forget nature
  end if;
  if p_event_type not in ('page_view', 'asset_opened', 'asset_played') then
    return; -- invalid type -- silently no-op rather than raise into the caller
  end if;

  insert into public.tracking_events (package_id, event_type, slot_name)
  values (v_package_id, p_event_type, left(p_slot_name, 100));
end;
$$;

revoke execute on function public.record_tracking_event(text, text, text) from public;
grant execute on function public.record_tracking_event(text, text, text) to anon, authenticated;

drop policy "tracking_events_insert_public" on public.tracking_events;
-- Deliberately no replacement INSERT policy: with none, RLS denies every
-- direct insert (anon and authenticated alike). The RPC above bypasses RLS
-- as its SECURITY DEFINER owner, so it remains the only way to record an
-- event, and it can only ever target the package matching the given slug.
