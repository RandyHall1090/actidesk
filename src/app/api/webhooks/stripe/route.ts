import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceLookupKey, tierFromLookupKey } from "@/lib/stripe/pricing";
import { mapStripeStatus } from "@/lib/stripe/status";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const stripe = getStripeClient();
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id;
      if (!orgId || !session.customer || !session.subscription) break;

      // The base tier Price is always the subscription's first item (see
      // createCheckoutSession -- an add-on seat, when present, is always
      // appended after it, never first).
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
        { expand: ["items.data.price"] },
      );
      const tier = tierFromLookupKey(priceLookupKey(subscription.items.data[0]?.price));

      await supabase
        .from("orgs")
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          subscription_status: "active",
          billing_tier: tier,
        })
        .eq("id", orgId);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const status = mapStripeStatus(subscription.status);
      const tier = tierFromLookupKey(priceLookupKey(subscription.items.data[0]?.price));

      await supabase
        .from("orgs")
        .update({
          subscription_status: status,
          ...(tier ? { billing_tier: tier } : {}),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("orgs")
        .update({ subscription_status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Newer API versions moved this off the top-level `subscription`
      // field (removed) into `parent.subscription_details` instead.
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof subscriptionRef === "string" ? subscriptionRef : (subscriptionRef?.id ?? null);
      if (!subscriptionId) break;
      await supabase
        .from("orgs")
        .update({ subscription_status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId);
      break;
    }

    default:
      // Unhandled event types are expected and fine -- Stripe sends many
      // more events than this app needs to react to.
      break;
  }

  return new Response("ok", { status: 200 });
}
