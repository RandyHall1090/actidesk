-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default when a
-- function is created. 0006's "revoke ... from anon" didn't remove that —
-- anon still inherited EXECUTE via PUBLIC (verified: anon could still call
-- is_org_admin directly after 0006). Must revoke from PUBLIC itself, then
-- re-affirm authenticated's explicit grant (a separate, independent grant
-- that revoking PUBLIC does not touch, but stating it again removes doubt).
--
-- Any future function meant to be non-public needs this same PUBLIC revoke,
-- not just a revoke from the specific role you're thinking of — see
-- 0002_restrict_handle_new_user_execute.sql, which got this right the first
-- time by revoking from public, anon, and authenticated together.
revoke execute on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated;
