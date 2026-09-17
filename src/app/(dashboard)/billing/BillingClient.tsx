"use client";

import { useState } from "react";
import { createCheckoutSession, createPortalSession } from "./actions";
import type { BillingTier, BillingInterval } from "@/lib/stripe/pricing";

type OrgBilling = {
  subscription_status: string;
  trial_ends_at: string;
  billing_exempt: boolean;
  billing_tier: string | null;
} | null;

const TIERS: {
  id: BillingTier;
  label: string;
  monthly: number;
  annual: number;
  seats: string;
}[] = [
  { id: "solo", label: "Solo", monthly: 49, annual: 470, seats: "1 seat" },
  { id: "team", label: "Team", monthly: 79, annual: 758, seats: "2 seats" },
  {
    id: "business",
    label: "Business",
    monthly: 129,
    annual: 1238,
    seats: "5 seats, add-on seats available",
  },
];

export function BillingClient({ org }: { org: OrgBilling }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(tier: BillingTier) {
    setLoading(tier);
    setError(null);
    const result = await createCheckoutSession(tier, interval);
    if ("error" in result) {
      setError(result.error);
      setLoading(null);
      return;
    }
    window.location.href = result.url;
  }

  async function handleManage() {
    setLoading("portal");
    setError(null);
    const result = await createPortalSession();
    if ("error" in result) {
      setError(result.error);
      setLoading(null);
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
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Billing</h2>

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
        (org.subscription_status === "past_due" || org.subscription_status === "canceled") && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">
            Your subscription is {org.subscription_status.replace("_", " ")}. Reps can view
            existing content but can&apos;t create anything new until this is resolved.
          </p>
        )}

      {hasSubscription && org.billing_tier && (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Current plan: <strong className="capitalize">{org.billing_tier}</strong>
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!org.billing_exempt && !hasSubscription && (
        <>
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setInterval("monthly")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                interval === "monthly"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "border border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                interval === "annual"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "border border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300"
              }`}
            >
              Annual (20% off)
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4"
              >
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t.label}
                </h3>
                <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                  ${interval === "monthly" ? t.monthly : Math.round(t.annual / 12)}
                  <span className="text-sm font-normal text-neutral-500">/mo</span>
                </p>
                {interval === "annual" && (
                  <p className="text-xs text-neutral-500">${t.annual}/yr billed upfront</p>
                )}
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{t.seats}</p>
                <button
                  onClick={() => handleSubscribe(t.id)}
                  disabled={loading !== null}
                  className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === t.id ? "Loading..." : `Choose ${t.label}`}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {!org.billing_exempt && hasSubscription && (
        <button
          onClick={handleManage}
          disabled={loading !== null}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading === "portal" ? "Loading..." : "Manage billing"}
        </button>
      )}
    </div>
  );
}
