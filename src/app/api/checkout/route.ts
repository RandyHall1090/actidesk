import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/env";
import { BILLING_TIERS, tierPriceLookupKey, resolvePriceId, type BillingTier } from "@/lib/stripe/pricing";

const INTERVALS = ["monthly", "annual"] as const;

function isBillingTier(value: string | null): value is BillingTier {
  return !!value && (BILLING_TIERS as readonly string[]).includes(value);
}

/**
 * Public, unauthenticated checkout entry point for the marketing site's
 * pricing cards -- there's no org yet, so unlike
 * (dashboard)/billing/actions.ts's createCheckoutSession this sets no
 * client_reference_id. The session is linked to an org after the fact by
 * signup/actions.ts's linkCheckoutSession, once one exists.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tier = searchParams.get("tier");
  const interval = searchParams.get("interval");
  const siteUrl = getSiteUrl();

  if (!isBillingTier(tier) || !INTERVALS.includes(interval as (typeof INTERVALS)[number])) {
    return NextResponse.redirect(`${siteUrl}/signup`);
  }

  const priceId = await resolvePriceId(
    tierPriceLookupKey(tier, interval as (typeof INTERVALS)[number]),
  );

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    success_url: `${siteUrl}/signup?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/signup`,
  });

  if (!session.url) {
    return NextResponse.redirect(`${siteUrl}/signup`);
  }

  return NextResponse.redirect(session.url);
}
