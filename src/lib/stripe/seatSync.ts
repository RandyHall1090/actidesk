import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { priceLookupKey, ADDON_SEAT_LOOKUP_KEY, TIER_INCLUDED_SEATS } from "@/lib/stripe/pricing";

/**
 * Pushes the org's current add-on-seat count to Stripe. Add-on seats
 * only exist on top of Business (see spec/plan.md's pricing decision) --
 * this is a deliberate no-op for Solo/Team orgs and for any org with no
 * subscription yet (the correct initial add-on count is set at Checkout
 * time instead -- see billing/actions.ts createCheckoutSession).
 */
export async function syncOrgSeatCount(orgId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("stripe_subscription_id, billing_tier")
    .eq("id", orgId)
    .single();
  if (!org?.stripe_subscription_id || org.billing_tier !== "business") return;

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_active", true);

  const overage = Math.max(0, (count ?? 0) - TIER_INCLUDED_SEATS.business);

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id, {
    expand: ["items.data.price"],
  });

  const addonItem = subscription.items.data.find((item) => {
    const key = priceLookupKey(item.price);
    return key === ADDON_SEAT_LOOKUP_KEY.monthly || key === ADDON_SEAT_LOOKUP_KEY.annual;
  });

  if (overage === 0) {
    // No add-on seats needed -- remove the line item entirely if one exists.
    if (addonItem) {
      await stripe.subscriptions.update(org.stripe_subscription_id, {
        items: [{ id: addonItem.id, deleted: true }],
      });
    }
    return;
  }

  if (addonItem) {
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      items: [{ id: addonItem.id, quantity: overage }],
    });
    return;
  }

  // First time crossing into add-on territory -- match the add-on
  // Price's interval to the base tier item's own interval (monthly base
  // + monthly add-on, annual + annual), never assumed.
  const baseInterval = subscription.items.data[0]?.price;
  const interval =
    typeof baseInterval !== "string" ? baseInterval?.recurring?.interval : undefined;
  const addonLookupKey =
    interval === "year" ? ADDON_SEAT_LOOKUP_KEY.annual : ADDON_SEAT_LOOKUP_KEY.monthly;

  const prices = await stripe.prices.list({ lookup_keys: [addonLookupKey], limit: 1 });
  const addonPrice = prices.data[0];
  if (!addonPrice) return;

  await stripe.subscriptions.update(org.stripe_subscription_id, {
    items: [{ price: addonPrice.id, quantity: overage }],
  });
}
