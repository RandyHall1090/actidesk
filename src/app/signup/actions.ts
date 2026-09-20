"use server";

import { syncOrgSeatCount } from "@/lib/stripe/seatSync";
import { getCurrentProfile } from "@/lib/profile";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceLookupKey, tierFromLookupKey } from "@/lib/stripe/pricing";
import { mapStripeStatus } from "@/lib/stripe/status";

/**
 * The signup page calls complete_signup() directly as an RPC from the
 * client (no server action involved), so a self-service "join" -- the
 * one seat-count change that doesn't go through team/actions.ts -- has
 * no natural server-side hook of its own. This is that hook.
 */
export async function syncSeatCountAfterJoin(orgId: string): Promise<void> {
  await syncOrgSeatCount(orgId);
}

/**
 * Links a Stripe Checkout Session created pre-signup (api/checkout/route.ts,
 * no client_reference_id -- there was no org yet) onto the org the buyer
 * just created. Called only right after signup's "create" branch, never
 * "join" -- someone joining an existing org isn't its billing owner.
 */
export async function linkCheckoutSession(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription.items.data.price"],
  });

  if (
    session.mode !== "subscription" ||
    (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")
  ) {
    return { ok: false, error: "Payment not confirmed." };
  }

  // Verify server-side against the just-created account's real email --
  // never trust that a client-supplied checkout_session_id belongs to the
  // person presenting it, since a leaked/guessed session id would otherwise
  // let one account claim someone else's payment.
  const sessionEmail = session.customer_details?.email ?? session.customer_email;
  if (
    !sessionEmail ||
    !profile.email ||
    sessionEmail.toLowerCase() !== profile.email.toLowerCase()
  ) {
    return { ok: false, error: "This payment doesn't match your account email." };
  }

  const subscription = session.subscription;
  if (!subscription || typeof subscription === "string") {
    return { ok: false, error: "Could not read subscription details." };
  }

  const tier = tierFromLookupKey(priceLookupKey(subscription.items.data[0]?.price));
  if (!tier) {
    return { ok: false, error: "Could not determine plan tier." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("orgs")
    .update({
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
      stripe_subscription_id: subscription.id,
      subscription_status: mapStripeStatus(subscription.status),
      billing_tier: tier,
    })
    .eq("id", profile.org_id);

  if (error) {
    // Unique violation on stripe_subscription_id -- this session was
    // already linked to a different org (e.g. a replayed success URL).
    if (error.code === "23505") {
      return { ok: false, error: "This payment was already linked to an account." };
    }
    return { ok: false, error: "Could not link your payment. Contact support." };
  }

  return { ok: true };
}
