-- orgs_update_admin (0010) has no `with check`, so any org admin can
-- currently write their own billing_tier/subscription_status/etc. via a
-- plain client-side update, self-granting a paid tier without ever paying
-- Stripe. Column-level REVOKE closes this without touching that policy or
-- an admin's ability to update non-billing columns (name, logo_url, ...).
-- The service-role client (webhook, checkout-linking) bypasses grants
-- entirely, so this only removes the client-authenticated write path.
revoke update (
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  billing_tier,
  trial_ends_at,
  billing_exempt
) on public.orgs from authenticated;
