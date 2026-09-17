"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/env";
import {
  tierPriceLookupKey,
  resolvePriceId,
  ADDON_SEAT_LOOKUP_KEY,
  TIER_INCLUDED_SEATS,
  type BillingTier,
  type BillingInterval,
} from "@/lib/stripe/pricing";

export async function createCheckoutSession(
  tier: BillingTier,
  billingInterval: BillingInterval,
): Promise<{ url: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Only admins can manage billing." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("id, stripe_customer_id")
    .eq("id", profile.org_id)
    .single();
  if (!org) return { error: "Organization not found." };

  const { count: seatCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", profile.org_id)
    .eq("is_active", true);

  const basePriceId = await resolvePriceId(tierPriceLookupKey(tier, billingInterval));
  const lineItems: { price: string; quantity: number }[] = [
    { price: basePriceId, quantity: 1 },
  ];

  // Add-on seats only exist on top of Business (see spec/plan.md's pricing
  // decision) -- if the org already has more active reps than Business's
  // included count, start the subscription with enough add-on seats
  // already attached rather than under-provisioning it from invoice one.
  if (tier === "business") {
    const overage = Math.max(0, (seatCount ?? 1) - TIER_INCLUDED_SEATS.business);
    if (overage > 0) {
      const addonPriceId = await resolvePriceId(ADDON_SEAT_LOOKUP_KEY[billingInterval]);
      lineItems.push({ price: addonPriceId, quantity: overage });
    }
  }

  const stripe = getStripeClient();
  const siteUrl = getSiteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: lineItems,
    client_reference_id: org.id,
    customer: org.stripe_customer_id ?? undefined,
    customer_email: org.stripe_customer_id ? undefined : (profile.email ?? undefined),
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    // No subscription_data.trial_period_days here -- the 14-day trial is
    // already handled entirely at the app level (orgs.trial_ends_at, set
    // once at org creation, independent of Stripe). Adding a second,
    // Stripe-side trial on top of that would just double the free period
    // for anyone who checks out mid-trial.
    success_url: `${siteUrl}/billing?checkout=success`,
    cancel_url: `${siteUrl}/billing?checkout=canceled`,
  });

  if (!session.url) return { error: "Could not start checkout." };
  return { url: session.url };
}

export async function createPortalSession(): Promise<
  { url: string } | { error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return { error: "Only admins can manage billing." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("stripe_customer_id")
    .eq("id", profile.org_id)
    .single();
  if (!org?.stripe_customer_id) {
    return { error: "No billing account yet -- subscribe first." };
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${getSiteUrl()}/billing`,
  });

  return { url: session.url };
}
