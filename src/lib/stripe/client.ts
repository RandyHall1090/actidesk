import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Single shared Stripe client, server-only. Never import this from a
 * Client Component -- STRIPE_SECRET_KEY must never reach the browser.
 */
export function getStripeClient(): Stripe {
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return cached;
}
