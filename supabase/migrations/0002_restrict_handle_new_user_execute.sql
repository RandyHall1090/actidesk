-- handle_new_user() is a trigger-only function (fires via on_auth_user_created).
-- PostgREST auto-exposes every public-schema function as an RPC endpoint by
-- default, including trigger functions, which should never be called directly.
-- Revoking EXECUTE from anon/authenticated closes that endpoint; the trigger
-- itself is unaffected since trigger firing bypasses normal EXECUTE grants.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
