-- 0031's column-level REVOKE was a no-op: Postgres column-level REVOKE
-- cannot narrow an existing table-wide GRANT, and Supabase's default setup
-- grants ALL table-wide to authenticated/anon on every public table.
-- Confirmed via information_schema.column_privileges after applying 0031 --
-- authenticated still had UPDATE on every billing column.
--
-- The actual fix: revoke the table-wide UPDATE grant entirely, then grant
-- back only the columns real UI code writes client-side today --
-- follow_up_enabled/follow_up_days, from (dashboard)/actions.ts, via the
-- regular session-bound client. Every other write to this table already
-- goes through the service-role client (webhook, checkout-linking,
-- complete_signup's SECURITY DEFINER insert, which runs with elevated
-- privileges regardless of the caller's own grants and so is unaffected).
revoke update on public.orgs from authenticated, anon;

grant update (follow_up_enabled, follow_up_days) on public.orgs to authenticated;
