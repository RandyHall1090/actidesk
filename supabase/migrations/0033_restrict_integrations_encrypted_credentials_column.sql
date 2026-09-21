-- Found 2026-09-21 during a security sweep: integrations_select_own_org
-- lets any member of an org (not just admins) read that row via the
-- session-bound client -- RLS is row-level only, so it can't stop a
-- non-admin rep from selecting the encrypted_credentials column directly
-- via the REST API for their own org's row. The ciphertext alone isn't
-- directly usable (AES-256-GCM, server-only key, never reaches the
-- client), but nothing in this app's own code ever needs to read this
-- column through the authenticated role -- the only reader is graph.ts's
-- getValidAccessToken(), which always uses the service-role admin client
-- and so is unaffected by this revoke. Least privilege: no session-bound
-- role should be able to select or write it at all.
revoke select (encrypted_credentials) on public.integrations from authenticated;
revoke insert (encrypted_credentials), update (encrypted_credentials)
  on public.integrations from authenticated;
