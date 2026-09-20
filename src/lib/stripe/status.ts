import type Stripe from "stripe";

/**
 * Stripe has more granular statuses (incomplete, incomplete_expired,
 * trialing, unpaid, ...) than this app's 4-value subscription_status --
 * anything not explicitly "active" or a known problem state maps to
 * past_due, the safe (soft-blocking) default rather than silently active.
 */
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): "active" | "past_due" | "canceled" {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "canceled" || stripeStatus === "unpaid") return "canceled";
  return "past_due";
}
