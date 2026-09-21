-- The previous migration's column-level REVOKE was a no-op for the exact
-- reason documented in 0032_actually_restrict_orgs_billing_columns.sql:
-- Postgres column-level REVOKE cannot narrow an existing table-wide GRANT,
-- and Supabase's default setup grants ALL table-wide to authenticated on
-- every public table. Confirmed via information_schema.column_privileges
-- after applying the previous migration -- authenticated still had
-- SELECT/INSERT/UPDATE on encrypted_credentials.
--
-- Same real fix as 0032: revoke the table-wide grant entirely, then grant
-- back only the columns the session-bound client actually reads/writes
-- today (the /integrations page's own SELECT list, and no client-side
-- write path exists for any column -- the OAuth callback and graph.ts
-- token refresh both go through the service-role client, unaffected by
-- authenticated's grants either way).
revoke select, insert, update on public.integrations from authenticated;

grant select (id, org_id, provider, status, connected_by, connected_at, updated_at)
  on public.integrations to authenticated;
