# T34: Self-Serve Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Online Shock-and-Awe from a free, unrestricted multi-tenant app into a real self-serve SaaS product — new orgs get a 14-day free trial, then must subscribe (per-seat, via Stripe Checkout) to keep creating content; a lapsed org goes read-only, not locked out; Securafy's own org is permanently exempt.

**Architecture:** A handful of new columns on `orgs` carry billing state (`subscription_status`, `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id`, `billing_exempt`). Stripe Checkout (subscription mode, `allow_promotion_codes: true`) creates the subscription; the Stripe-hosted Customer Portal handles all ongoing self-service management (update card, cancel, view invoices) so no custom billing UI is needed for that part. A single webhook route keeps `orgs` in sync with Stripe as the source of truth. Seat quantity (price × active rep count) is pushed to Stripe whenever an org's active rep count changes. A shared guard checked at the top of every content-creating server action enforces the soft-block.

**Tech Stack:** Stripe (Checkout, Customer Portal, Webhooks), provisioned via the Vercel Marketplace integration (`vercel integration add stripe`) rather than hand-wiring the SDK from scratch — this auto-configures `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` as real env vars. `stripe` npm package for server-side API calls.

**Spec:** `spec/plan.md` (Tech decisions bullet for T34) — this plan is the only detailed doc; there is no separate design-spec file per this repo's convention (see T29–T33).

## Global Constraints

- **Trial length**: 14 days from org creation, no card required.
- **`subscription_status` values**: `'trialing'` | `'active'` | `'past_due'` | `'canceled'` — this exact set, enforced by a CHECK constraint.
- **Soft-block only**: an org is blocked from *creating* new content when `billing_exempt = false` AND `subscription_status IN ('past_due', 'canceled')` AND NOT (`subscription_status = 'trialing'` AND `trial_ends_at > now()`). In every other case, nothing is blocked. Existing content (including already-sent `/s/[slug]` prospect pages) is **never** blocked regardless of billing state.
- **Seat quantity** = count of `profiles` rows where `org_id = <org>` and `is_active = true`. This is what gets pushed to the Stripe subscription's item quantity.
- **Securafy's own org** (`00000000-0000-0000-0000-000000000001`) has `billing_exempt = true`, `subscription_status = 'active'` — set once in the migration, never touched again.
- **Promo codes**: every Checkout Session sets `allow_promotion_codes: true`. No app code creates or manages individual coupons/promotion codes — that's done directly in the Stripe Dashboard (see Task 1's note).
- **No test framework in this repo** — every task verifies via real manual/CLI checks (Supabase SQL, Stripe CLI/Dashboard, a real browser), matching T29–T33's convention, not automated tests.
- **Env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (the recurring per-seat Price ID) — all added to `.env.local` (gitignored) and `.env.example` (blank placeholders + comments).
- **Package install and CLI installs require Randy's explicit approval** before running (global rule) — every step that installs something is flagged inline; do not run it silently.

---

## ⚠️ Pricing finalized 2026-09-17 — supersedes this plan's single-price assumption

This plan was written before pricing was decided and assumes one flat per-seat `STRIPE_PRICE_ID` (quantity = active rep count). **That assumption is now wrong.** The real, finalized pricing is three named tiers plus a restricted add-on seat:

| Tier | Users | Monthly | Per-seat | Annual (20% off, paid upfront) |
|---|---|---|---|---|
| Solo | 1 | $49 | $49.00 | $470/yr |
| Team | 2 | $79 | $39.50 | $758/yr |
| Business | 5 | $129 | $25.80 | $1,238/yr |
| Add-on seat | 6+ | +$19/user | $19.00 | +$182/yr per seat |

**Business rule that must be enforced in code, not just in the Stripe Dashboard**: the $19 add-on seat can only be attached to a subscription on the Business tier. Solo and Team orgs cannot buy add-on seats — going over their included seat count means upgrading to the next tier, not stacking add-ons. This is what keeps per-seat cost falling monotonically ($49 → $39.50 → $25.80 → $19) and avoids an arbitrage where a customer undercuts Team/Business by stacking cheap add-ons onto Solo. Accepted tradeoff: a 3-4 rep org must buy 5-seat Business and pay for unused headroom — deliberate, not a bug.

### ✅ Stripe-side setup DONE (2026-09-17, live mode) — real Products/Prices already exist

Created directly via the Stripe MCP in Randy's live Stripe account ("Securafy Inc", `acct_1U18xcAuT4LPyEyv`) — confirmed with Randy first that livemode was the only account connected (no sandbox available) and he chose to proceed live rather than wait for a sandbox. Each tier is its own Product (per Stripe's own guidance: never put multiple tiers' prices on one Product), each with a monthly and an annual Price. Real IDs, not placeholders:

| Product | Product ID | Monthly Price (lookup_key) | Annual Price (lookup_key) |
|---|---|---|---|
| ActiDesk Solo | `prod_VHKEr2uSvjuquS` | `price_1UGlarAuT4LPyEyvcVeMYAL4` (`actidesk_solo_monthly`) | `price_1UGlatAuT4LPyEyvLlOKILXU` (`actidesk_solo_annual`) |
| ActiDesk Team | `prod_VHKECEgz7TRwk3` | `price_1UGlavAuT4LPyEyvzdj5lQYD` (`actidesk_team_monthly`) | `price_1UGlaxAuT4LPyEyv8HO5ZyC2` (`actidesk_team_annual`) |
| ActiDesk Business | `prod_VHKEGDGTgS67NW` | `price_1UGlbCAuT4LPyEyvfXrxUEgD` (`actidesk_business_monthly`) | `price_1UGlbEAuT4LPyEyv1g1CwCto` (`actidesk_business_annual`) |
| ActiDesk Add-on Seat | `prod_VHKEBD5UCq8Yah` | `price_1UGlbGAuT4LPyEyvIknZPd4D` (`actidesk_addon_seat_monthly`) | `price_1UGlbWAuT4LPyEyvicu1BmKu` (`actidesk_addon_seat_annual`) |

Each product's `default_price` is set to its monthly Price. All 8 Prices use `lookup_key`s (shown above) so app code should resolve Prices by lookup key via `stripe.prices.list({ lookup_keys: [...] })`, not by hardcoding these Price IDs directly — that keeps a future price change (Stripe Prices are immutable; a "change" means creating a new Price and re-pointing the lookup_key) from requiring a code deploy. **This account has no test-mode/sandbox equivalent of these objects** — until a sandbox is connected, testing the Checkout flow means either testing carefully against these real live Prices (e.g., $0 via a 100%-off test coupon) or standing up a separate sandbox first and re-creating the same 4 Products/8 Prices there.

**What still needs building (Task 1's remaining DB/env-var pieces, plus Tasks 3/5):**
- **Task 1**: still needs the `orgs` billing-columns migration (`subscription_status`, `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id`, `billing_exempt`) *plus a new `billing_tier` column* (`'solo' | 'team' | 'business'`); `STRIPE_PRICE_ID` (singular) as originally planned is no longer the right env-var shape — the app should look up Prices by the lookup_keys above instead of a single hardcoded ID.
- **Task 3**'s Checkout Session creation (`createCheckoutSession`) needs a tier selector (which of the 3 base Prices to use, by lookup_key) and, for Business only, an optional add-on-seat line item — not the current flat `quantity: seatCount` against one Price.
- **Task 5**'s seat-sync logic (`syncOrgSeatCount`) needs to become tier-aware: syncing "seat count" now means syncing the *add-on seat quantity above the tier's included count* (e.g., Business + 7 active reps = 2 add-on seats), and must never run for Solo/Team orgs at all.

This plan's remaining tasks are still structurally correct (webhook sync, Customer Portal, trial, soft-block gating, promo codes) — only the pricing-shape-specific pieces above need a revision pass before building. Do that revision pass first; don't build the rest of Task 1 (and Tasks 3/5) as currently written.

---

### Task 1: Provision Stripe + billing columns migration

**Files:**
- Create: `supabase/migrations/0030_billing_columns.sql` (renumbered 2026-09-17: 0026/0027 were claimed by T36/T38, built first)
- Modify: `.env.example` (add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`)
- Modify: `package.json` (new dependency: `stripe`)

**Interfaces:**
- Produces: `orgs.subscription_status`, `orgs.trial_ends_at`, `orgs.stripe_customer_id`, `orgs.stripe_subscription_id`, `orgs.billing_exempt` — every later task reads/writes these exact column names.
- Produces: real values for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` in `.env.local`, which Task 2/3 code reads via `process.env`.

- [ ] **Step 1: Install the Vercel CLI (ask Randy first — this is a global package install)**

The Vercel CLI is not currently installed. Ask before running:

```bash
npm i -g vercel
```

- [ ] **Step 2: Link the project and provision Stripe via the Vercel Marketplace integration**

```bash
vercel link --yes
vercel integration categories
vercel integration discover --category payments
```

Confirm Stripe is the top `payments` result (it is Vercel's preferred provider for "charging money with no catalog" — matches this app exactly, since there's no product catalog, just subscriptions). Then:

```bash
vercel integration add stripe --yes
```

Stripe is a **connectable** integration — the CLI can't finish account auth itself. If it prints a dashboard/browser link, stop and ask Randy to complete that step (connecting or creating his Stripe account), then continue.

- [ ] **Step 3: Create the per-seat recurring Price in the Stripe Dashboard (test mode first)**

In the Stripe Dashboard (test mode toggle on): Products → Add product → name it "Shock-and-Awe Rep Seat" → recurring price, monthly, USD. Leave the amount as a placeholder for now (Randy sets the real number once the cost/competitor research comes back) — record the resulting Price ID (starts with `price_`).

- [ ] **Step 4: Pull real env vars and add the Price ID**

```bash
vercel env pull --yes
```

This populates `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (auto-configured by the integration) into `.env.local`. Manually add the Price ID from Step 3:

```
STRIPE_PRICE_ID=price_xxxxxxxxxxxxx
```

- [ ] **Step 5: Add placeholders to `.env.example`**

```
# --- Stripe (subscription billing) ---
# Auto-configured by the Vercel Stripe integration (`vercel integration add stripe`) —
# do not hand-generate these.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# The recurring per-seat Price ID, created manually in the Stripe Dashboard
# (Products), not part of the Vercel integration's auto env vars.
STRIPE_PRICE_ID=
```

- [ ] **Step 6: Install the `stripe` npm package (ask Randy first)**

```bash
npm install stripe
```

- [ ] **Step 7: Write and apply the migration**

```sql
-- 0030_billing_columns.sql
alter table public.orgs
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column subscription_status text not null default 'trialing',
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column billing_exempt boolean not null default false;

alter table public.orgs
  add constraint orgs_subscription_status_check
  check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));

-- Nullable but unique when present -- Postgres partial unique indexes treat
-- NULL as distinct, so many orgs can share "no customer yet" with no conflict.
create unique index orgs_stripe_customer_id_idx
  on public.orgs (stripe_customer_id) where stripe_customer_id is not null;
create unique index orgs_stripe_subscription_id_idx
  on public.orgs (stripe_subscription_id) where stripe_subscription_id is not null;

-- Securafy is the platform operator, not a paying customer -- permanently
-- exempt, set once here and never touched by any webhook/billing code path.
update public.orgs
set billing_exempt = true, subscription_status = 'active'
where id = '00000000-0000-0000-0000-000000000001';
```

Apply via `mcp__supabase__apply_migration` (name: `billing_columns`).

- [ ] **Step 8: Verify live**

Run against the real database:

```sql
select id, name, subscription_status, trial_ends_at, billing_exempt
from public.orgs
where id = '00000000-0000-0000-0000-000000000001';
-- Expect: subscription_status = 'active', billing_exempt = true

select subscription_status, trial_ends_at, billing_exempt
from public.orgs
where id != '00000000-0000-0000-0000-000000000001'
limit 5;
-- Expect every existing org: subscription_status = 'trialing',
-- trial_ends_at ~14 days from migration time, billing_exempt = false
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0030_billing_columns.sql .env.example package.json package-lock.json
git commit -m "feat: add Stripe billing columns to orgs"
```

---

### Task 2: Stripe client helper + webhook handler

**Files:**
- Create: `src/lib/stripe/client.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `process.env.STRIPE_SECRET_KEY`, `process.env.STRIPE_WEBHOOK_SECRET` (Task 1).
- Produces: `getStripeClient(): Stripe` from `src/lib/stripe/client.ts` — Task 3's checkout/portal actions import this same helper, never construct their own `Stripe` instance.
- Consumes: `createAdminClient()` from `src/lib/supabase/admin.ts` (existing) — the webhook has no user session, matches the pattern already used for `GATE_DESK`/T33's admin mutations.

- [ ] **Step 1: Write the Stripe client helper**

```typescript
// src/lib/stripe/client.ts
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
```

- [ ] **Step 2: Write the webhook route**

```typescript
// src/app/api/webhooks/stripe/route.ts
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
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
      await supabase
        .from("orgs")
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          subscription_status: "active",
        })
        .eq("id", orgId);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const status = mapStripeStatus(subscription.status);
      await supabase
        .from("orgs")
        .update({ subscription_status: status })
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
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : null;
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

/**
 * Stripe has more granular statuses (incomplete, incomplete_expired,
 * trialing, unpaid, ...) than this app's 4-value subscription_status --
 * anything not explicitly "active" or a known problem state maps to
 * past_due, the safe (soft-blocking) default rather than silently active.
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): "active" | "past_due" | "canceled" {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "canceled" || stripeStatus === "unpaid") return "canceled";
  return "past_due";
}
```

- [ ] **Step 3: Configure the webhook endpoint in Stripe**

In the Stripe Dashboard (test mode): Developers → Webhooks → Add endpoint → URL `https://<your-preview-or-prod-url>/api/webhooks/stripe` (or use the Stripe CLI locally, next step) → select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

- [ ] **Step 4: Verify live with the Stripe CLI**

Install the Stripe CLI if not already present (ask Randy first — https://stripe.com/docs/stripe-cli), then:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

In a second terminal, with the dev server running:

```bash
stripe trigger checkout.session.completed
```

Confirm the route returns 200 and logs no signature error. Since a real trigger event won't carry a real `client_reference_id` matching a test org, also verify the signature-rejection path directly:

```bash
curl -i -X POST http://localhost:3000/api/webhooks/stripe -d '{}'
```

Expect `400 Invalid signature` (no valid `stripe-signature` header was sent).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe/client.ts src/app/api/webhooks/stripe/route.ts
git commit -m "feat: add Stripe webhook handler for subscription status sync"
```

---

### Task 3: Checkout + Customer Portal actions and Billing page

**Files:**
- Create: `src/app/(dashboard)/billing/actions.ts`
- Create: `src/app/(dashboard)/billing/page.tsx`
- Create: `src/app/(dashboard)/billing/BillingClient.tsx`
- Modify: nav/layout to add an admin-only "Billing" link (find the existing dashboard nav list, e.g. alongside the existing "Team"/"Admin" links)

**Interfaces:**
- Consumes: `getStripeClient()` (Task 2), `getCurrentProfile()` (existing, `src/lib/profile.ts`), `process.env.STRIPE_PRICE_ID` (Task 1).
- Produces: `createCheckoutSession(): Promise<{ url: string } | { error: string }>` and `createPortalSession(): Promise<{ url: string } | { error: string }>`, both exported from `src/app/(dashboard)/billing/actions.ts` — consumed only by `BillingClient.tsx` in this task.

- [ ] **Step 1: Write the billing actions**

```typescript
// src/app/(dashboard)/billing/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getStripeClient } from "@/lib/stripe/client";

export async function createCheckoutSession(): Promise<
  { url: string } | { error: string }
> {
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

  const stripe = getStripeClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: seatCount ?? 1 }],
    client_reference_id: org.id,
    customer: org.stripe_customer_id ?? undefined,
    customer_email: org.stripe_customer_id ? undefined : (profile.email ?? undefined),
    allow_promotion_codes: true,
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
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
  });

  return { url: session.url };
}
```

- [ ] **Step 2: Write the Billing page (server component, fetches current status)**

```tsx
// src/app/(dashboard)/billing/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("subscription_status, trial_ends_at, billing_exempt")
    .eq("id", profile.org_id)
    .single();

  return <BillingClient org={org} />;
}
```

- [ ] **Step 3: Write the Billing client component**

```tsx
// src/app/(dashboard)/billing/BillingClient.tsx
"use client";

import { useState } from "react";
import { createCheckoutSession, createPortalSession } from "./actions";

type OrgBilling = {
  subscription_status: string;
  trial_ends_at: string;
  billing_exempt: boolean;
} | null;

export function BillingClient({ org }: { org: OrgBilling }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    const result = await createCheckoutSession();
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    window.location.href = result.url;
  }

  async function handleManage() {
    setLoading(true);
    setError(null);
    const result = await createPortalSession();
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    window.location.href = result.url;
  }

  if (!org) return null;

  const hasSubscription = org.subscription_status === "active";
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86_400_000),
  );

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Billing
      </h2>

      {org.billing_exempt && (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          This organization is exempt from billing.
        </p>
      )}

      {!org.billing_exempt && org.subscription_status === "trialing" && (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Free trial -- {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left.
        </p>
      )}

      {!org.billing_exempt &&
        (org.subscription_status === "past_due" ||
          org.subscription_status === "canceled") && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            Your subscription is {org.subscription_status.replace("_", " ")}.
            Reps can view existing content but can&apos;t create anything new
            until this is resolved.
          </p>
        )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!org.billing_exempt && (
        <button
          onClick={hasSubscription ? handleManage : handleSubscribe}
          disabled={loading}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : hasSubscription ? "Manage billing" : "Subscribe"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the nav link**

Find the existing admin-only nav links (Team/Admin) in the dashboard layout/nav component and add a "Billing" link to `/billing` alongside them, same visibility condition (`profile.role === "admin"`).

- [ ] **Step 5: Verify live**

With `STRIPE_PRICE_ID` set to a real test-mode price: log in as an admin on a trialing test org, visit `/billing`, confirm it shows the trial countdown. Click Subscribe, complete Stripe test Checkout with card `4242 4242 4242 4242`, confirm redirect back to `/billing?checkout=success`. Once Task 2's webhook has processed the event, reload `/billing` and confirm it now shows "Manage billing" instead of "Subscribe". Click "Manage billing", confirm it lands on the real Stripe Customer Portal for that customer.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/billing"
git commit -m "feat: add Billing page with Stripe Checkout and Customer Portal"
```

---

### Task 4: Billing gating guard on content-creating actions

**Files:**
- Create: `src/lib/billing.ts`
- Modify: `src/app/(dashboard)/packages/new/actions.ts` (guard `savePackage`/`createPackage`)
- Modify: `src/app/(dashboard)/library/actions.ts` (guard `createLinkAsset`, `createFileAssetRecord`)
- Modify: `src/app/(dashboard)/templates/actions.ts` (guard `savePreset`)
- Modify: `src/app/(dashboard)/templates/layout-designer/actions.ts` (guard `saveLayout`)

**Interfaces:**
- Produces: `requireActiveBilling(orgId: string): Promise<string | null>` from `src/lib/billing.ts` — returns `null` when the org may create content, or a user-facing error string when blocked. Every modified action calls this immediately after resolving the caller's profile and returns that string as its own error result if non-null (matching each action's existing `{ error: string }`-shaped return, not throwing).

- [ ] **Step 1: Write the guard**

```typescript
// src/lib/billing.ts
import { createClient } from "@/lib/supabase/server";

const BLOCKED_MESSAGE =
  "Your organization's trial has ended or billing needs attention -- visit Billing to keep creating new content.";

/**
 * Soft-block check: existing content (including already-sent /s/[slug]
 * pages) is never affected -- this only gates *new* creation. Returns null
 * (not blocked) for an active subscription, an in-window trial, or an
 * exempt org; returns a user-facing message otherwise.
 */
export async function requireActiveBilling(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("subscription_status, trial_ends_at, billing_exempt")
    .eq("id", orgId)
    .single();
  if (!org) return null; // fail open on a lookup miss -- not a billing decision to make here

  if (org.billing_exempt) return null;
  if (org.subscription_status === "active") return null;
  if (org.subscription_status === "trialing" && new Date(org.trial_ends_at) > new Date()) {
    return null;
  }
  return BLOCKED_MESSAGE;
}
```

- [ ] **Step 2: Wire into each action**

In each of the four files, immediately after the existing `getCurrentProfile()` call (before any DB write), add:

```typescript
const billingError = await requireActiveBilling(profile.org_id);
if (billingError) return { error: billingError };
```

(matching whatever the surrounding function's existing early-return shape already is in that file -- e.g. `{ ok: false, error: billingError }` if that's the local convention instead of `{ error: billingError }`; follow the file's own existing pattern rather than the literal snippet above.)

- [ ] **Step 3: Verify live via SQL role-simulation**

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<a real rep uuid>","role":"authenticated"}';
  -- with that rep's org set to subscription_status = 'canceled', billing_exempt = false:
  -- attempt the equivalent of createPackage/createLinkAsset/savePreset/saveLayout
  -- through the app (not raw SQL -- the guard runs in the server action, not RLS)
rollback;
```

Since the guard is application-level (not RLS), verify via a real browser/action call instead: temporarily set a test org's `subscription_status = 'canceled'` directly via SQL, attempt to create a package/asset/template/layout as that org's rep in the running app, confirm each returns the blocked message and writes nothing; confirm Securafy's own org (`billing_exempt = true`) is completely unaffected throughout. Revert the test org's status back to `'trialing'` afterward.

- [ ] **Step 4: Commit**

```bash
git add src/lib/billing.ts "src/app/(dashboard)/packages/new/actions.ts" "src/app/(dashboard)/library/actions.ts" "src/app/(dashboard)/templates/actions.ts" "src/app/(dashboard)/templates/layout-designer/actions.ts"
git commit -m "feat: soft-block content creation for lapsed/expired billing"
```

---

### Task 5: Seat sync (Team actions + self-service join)

**Files:**
- Create: helper added to `src/lib/billing.ts` (same file as Task 4)
- Modify: `src/app/(dashboard)/team/actions.ts` (`addTeamMember`, `setTeamMemberActive`)
- Modify: `src/app/signup/page.tsx` (after a successful self-service `'join'`)
- Create: `src/app/signup/actions.ts` (a tiny new server action, since the signup page currently calls the `complete_signup` RPC directly from the client and has no existing server action file to extend)

**Interfaces:**
- Consumes: `getStripeClient()` (Task 2).
- Produces: `syncOrgSeatCount(orgId: string): Promise<void>` from `src/lib/billing.ts`, exported alongside `requireActiveBilling` — consumed by both `team/actions.ts` and the new `src/app/signup/actions.ts`.

- [ ] **Step 1: Add the seat-sync helper**

```typescript
// added to src/lib/billing.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * Pushes the org's current active-rep count to Stripe as the subscription
 * item quantity. No-ops for an org with no subscription yet (still
 * trialing) -- the correct initial quantity is set at Checkout time
 * instead (see billing/actions.ts createCheckoutSession).
 */
export async function syncOrgSeatCount(orgId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("stripe_subscription_id")
    .eq("id", orgId)
    .single();
  if (!org?.stripe_subscription_id) return;

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_active", true);

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) return;

  await stripe.subscriptions.update(org.stripe_subscription_id, {
    items: [{ id: itemId, quantity: count ?? 1 }],
  });
}
```

- [ ] **Step 2: Call it from Team actions**

In `src/app/(dashboard)/team/actions.ts`, after each successful mutation, call the sync (fire-and-forget is acceptable here -- a seat-count drift of a few seconds is not worth blocking the UI response on):

In `addTeamMember`, after `if (result.ok) revalidatePath("/team");` add `if (result.ok) await syncOrgSeatCount(profile.org_id);`.

In `setTeamMemberActive`, after `if (result.ok) revalidatePath("/team");` add `if (result.ok) await syncOrgSeatCount(profile.org_id);`.

- [ ] **Step 3: Handle the self-service join path**

Create a minimal server action so the client-side signup page can trigger the sync after a successful `'join'` (it cannot call `syncOrgSeatCount` directly -- that needs to run server-side):

```typescript
// src/app/signup/actions.ts
"use server";

import { syncOrgSeatCount } from "@/lib/billing";

export async function syncSeatCountAfterJoin(orgId: string): Promise<void> {
  await syncOrgSeatCount(orgId);
}
```

In `src/app/signup/page.tsx`, after the existing `complete_signup` RPC call succeeds with `p_action: 'join'` (find the exact success branch -- it returns the new profile row, which includes `org_id`), add a call to `syncSeatCountAfterJoin(profile.org_id)`. Do not block the redirect on it finishing.

- [ ] **Step 4: Verify live**

With a test org that has an active test subscription (from Task 3's verification): invite a new rep via Team (`addTeamMember`), confirm the Stripe subscription's quantity in the Stripe Dashboard increases by 1. Deactivate a rep via Team, confirm quantity decreases by 1. Have a second test user sign up with a matching email domain (self-service join), confirm quantity increases by 1 again.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing.ts "src/app/(dashboard)/team/actions.ts" src/app/signup/actions.ts src/app/signup/page.tsx
git commit -m "feat: sync Stripe subscription seat count on rep add/remove/join"
```

---

### Task 6: Trial banner + full end-to-end verification

**Files:**
- Create: `src/app/(dashboard)/TrialBanner.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (render the banner, matching the existing `OneTimePasswordBanner.tsx` pattern already used there)

**Interfaces:**
- Consumes: same `orgs` columns as Task 3/4 (`subscription_status`, `trial_ends_at`, `billing_exempt`), fetched once in the dashboard layout and passed down like the existing profile data already is.

- [ ] **Step 1: Write the banner**

```tsx
// src/app/(dashboard)/TrialBanner.tsx
type OrgBillingInfo = {
  subscription_status: string;
  trial_ends_at: string;
  billing_exempt: boolean;
};

export function TrialBanner({ org }: { org: OrgBillingInfo }) {
  if (org.billing_exempt) return null;

  if (org.subscription_status === "trialing") {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86_400_000),
    );
    return (
      <div className="bg-blue-50 dark:bg-blue-950 px-4 py-2 text-center text-sm text-blue-800 dark:text-blue-300">
        Free trial -- {daysLeft} day{daysLeft === 1 ? "" : "s"} left.{" "}
        <a href="/billing" className="font-semibold underline">
          Subscribe
        </a>
      </div>
    );
  }

  if (org.subscription_status === "past_due" || org.subscription_status === "canceled") {
    return (
      <div className="bg-red-50 dark:bg-red-950 px-4 py-2 text-center text-sm text-red-800 dark:text-red-300">
        Billing needs attention -- new content is blocked until this is
        resolved.{" "}
        <a href="/billing" className="font-semibold underline">
          Fix billing
        </a>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Wire it into the dashboard layout**

In `src/app/(dashboard)/layout.tsx`, fetch the current org's `subscription_status, trial_ends_at, billing_exempt` alongside the existing profile fetch, and render `<TrialBanner org={org} />` in the same place `OneTimePasswordBanner` already renders.

- [ ] **Step 3: Full end-to-end live verification**

Walk the entire flow against real test-mode Stripe data:
1. A brand-new signup (fresh email domain) shows `trialing` with a 14-day countdown banner.
2. Admin subscribes via `/billing` (Checkout, test card `4242 4242 4242 4242`) -- banner disappears, `/billing` shows "Manage billing".
3. Apply a test promo code at Checkout (create one in the Stripe Dashboard first: percent_off 50, duration repeating 12 months) -- confirm the Checkout page shows the discount applied.
4. In the Stripe Dashboard (test mode), cancel the subscription -- confirm the webhook flips `subscription_status` to `canceled`, the red banner appears, and creating a new package/asset/template/layout is blocked with the friendly message while existing packages/library/templates remain fully viewable.
5. Reactivate via "Manage billing" (Customer Portal) -- confirm `active` again and creation unblocked.
6. Confirm Securafy's own org is unaffected by any of the above (no banner, `/billing` shows the exempt message, nothing ever blocked).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/TrialBanner.tsx" "src/app/(dashboard)/layout.tsx"
git commit -m "feat: add trial/billing status banner to dashboard"
```

---

## Self-Review

**Spec coverage:** trial (Task 1 defaults + Task 6 banner), Checkout/Portal (Task 3), webhook sync (Task 2), per-seat quantity (Task 3 initial + Task 5 ongoing), soft-block gating (Task 4), Securafy exemption (Task 1), promo codes (Task 3's `allow_promotion_codes`, no separate task needed) -- every approved design element has a task.

**Placeholder scan:** no TBD/TODO; the one deliberately-unset value (the actual seat price in Stripe) is explicitly flagged in Task 1 Step 3 as pending the cost/competitor research already in flight, not an oversight.

**Type consistency:** `requireActiveBilling`/`syncOrgSeatCount` signatures in Task 4/5 match their declarations in `src/lib/billing.ts`; `getStripeClient()` used identically in Tasks 2, 3, and 5.
