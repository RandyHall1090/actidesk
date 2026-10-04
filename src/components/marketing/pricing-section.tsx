"use client";

import { useState } from "react";

type Interval = "annual" | "monthly";

// Annual is shown first and selected by default (Q4 2026 sprint rule:
// annual price first wherever one exists). Annual prices are the published
// 20%-off figures, unchanged.
const PRICING_TIERS = [
  { tier: "solo", name: "Solo", annual: "$470/yr", monthly: "$49/mo", detail: "1 rep", popular: false },
  {
    tier: "team",
    name: "Team",
    annual: "$758/yr",
    monthly: "$79/mo",
    detail: "2 reps · add-on seats available",
    popular: false,
  },
  {
    tier: "business",
    name: "Business",
    annual: "$1,238/yr",
    monthly: "$129/mo",
    detail: "5 reps · add-on seats available",
    popular: true,
  },
];

const INTERVALS: { value: Interval; label: string }[] = [
  { value: "annual", label: "Annual · save 20%" },
  { value: "monthly", label: "Monthly" },
];

export function PricingSection() {
  const [interval, setBillingInterval] = useState<Interval>("annual");

  return (
    <section id="pricing" className="border-b border-steel-line/60 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-bold text-bone sm:text-4xl">Pricing</h2>
        <p className="mt-3 text-sm text-bone-dim">
          Every account starts with a 14-day free trial, no credit card needed. Or pick a plan below to
          subscribe now.
        </p>

        <div role="radiogroup" aria-label="Billing interval" className="mt-6 inline-flex rounded-sm border border-steel-line p-1">
          {INTERVALS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={interval === option.value}
              onClick={() => setBillingInterval(option.value)}
              className={`rounded-sm px-4 py-1.5 font-mono-brand text-xs uppercase tracking-wider ${
                interval === option.value ? "bg-electric text-ink" : "text-bone-dim hover:text-bone"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-sm border p-6 ${
                tier.popular ? "border-electric bg-steel/40" : "border-steel-line bg-steel/20"
              }`}
            >
              {tier.popular && (
                <p className="font-mono-brand text-xs uppercase tracking-wider text-electric">
                  Most popular
                </p>
              )}
              <h3 className="mt-2 font-display text-xl font-bold text-bone">{tier.name}</h3>
              <p className="mt-2 font-display text-3xl font-bold text-bone">
                {interval === "annual" ? tier.annual : tier.monthly}
              </p>
              <p className="mt-1 text-xs text-bone-dim">
                {interval === "annual" ? `or ${tier.monthly} billed monthly` : `or ${tier.annual} billed annually`}
              </p>
              <p className="mt-2 text-sm text-bone-dim">{tier.detail}</p>
              {/* A plain <a>, not <Link>: this hits an API route that
                  redirects to Stripe Checkout, not an app page. */}
              <a
                href={`/api/checkout?tier=${tier.tier}&interval=${interval}`}
                className={`mt-4 inline-block w-full rounded-sm px-4 py-2 text-center font-mono-brand text-xs uppercase tracking-wider ${
                  tier.popular
                    ? "bg-electric text-ink hover:bg-electric/90"
                    : "border border-steel-line text-bone hover:border-electric"
                }`}
              >
                Choose {tier.name}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-bone-dim">
          Need more reps? Add-on seats are $374/yr ($39/user/mo monthly) on Team and $182/yr
          ($19/user/mo monthly) on Business. Solo accounts upgrade to Team to add a second rep.
        </p>
      </div>
    </section>
  );
}
