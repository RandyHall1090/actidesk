import type Stripe from "stripe";
import { getStripeClient } from "./client";

/**
 * The 3 named Stripe Products (each its own Product, per Stripe's own
 * guidance never to put multiple tiers' Prices on one Product) created
 * 2026-09-17 -- real Product/Price IDs recorded in
 * plans/2026-09-17-t34-stripe-billing.md. Resolved here by lookup_key,
 * not hardcoded Price ID, so a future price change (Prices are
 * immutable -- a "change" means a new Price + repointed lookup_key)
 * never requires a code deploy.
 */
export const BILLING_TIERS = ["solo", "team", "business"] as const;
export type BillingTier = (typeof BILLING_TIERS)[number];
export type BillingInterval = "monthly" | "annual";

export const TIER_INCLUDED_SEATS: Record<BillingTier, number> = {
  solo: 1,
  team: 2,
  business: 5,
};

export function tierPriceLookupKey(tier: BillingTier, interval: BillingInterval): string {
  return `actidesk_${tier}_${interval}`;
}

export const ADDON_SEAT_LOOKUP_KEY: Record<BillingInterval, string> = {
  monthly: "actidesk_addon_seat_monthly",
  annual: "actidesk_addon_seat_annual",
};

/** Reverses a lookup_key like "actidesk_business_monthly" back to its tier. */
export function tierFromLookupKey(lookupKey: string | null | undefined): BillingTier | null {
  if (!lookupKey) return null;
  for (const tier of BILLING_TIERS) {
    if (
      lookupKey === tierPriceLookupKey(tier, "monthly") ||
      lookupKey === tierPriceLookupKey(tier, "annual")
    ) {
      return tier;
    }
  }
  return null;
}

/**
 * A Stripe subscription item's `price` is a full Price object by default
 * (not just an ID) -- this guards the type anyway rather than assuming,
 * since a wrong assumption here would silently break billing_tier sync.
 */
export function priceLookupKey(price: Stripe.Price | string | null | undefined): string | null {
  if (!price || typeof price === "string") return null;
  return price.lookup_key ?? null;
}

export async function resolvePriceId(lookupKey: string): Promise<string> {
  const stripe = getStripeClient();
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const price = prices.data[0];
  if (!price) throw new Error(`No Stripe Price found for lookup_key "${lookupKey}"`);
  return price.id;
}
