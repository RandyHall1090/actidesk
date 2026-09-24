const PRICING_TIERS = [
  { tier: "solo", name: "Solo", price: "$49/mo", detail: "1 rep", popular: false },
  {
    tier: "team",
    name: "Team",
    price: "$79/mo",
    detail: "2 reps · add-on seats available",
    popular: false,
  },
  {
    tier: "business",
    name: "Business",
    price: "$129/mo",
    detail: "5 reps · add-on seats available",
    popular: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-b border-steel-line/60 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-bold text-bone sm:text-4xl">Pricing</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
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
              <p className="mt-2 font-display text-3xl font-bold text-bone">{tier.price}</p>
              <p className="mt-2 text-sm text-bone-dim">{tier.detail}</p>
              {/* A plain <a>, not <Link>: this hits an API route that
                  redirects to Stripe Checkout, not an app page. */}
              <a
                href={`/api/checkout?tier=${tier.tier}&interval=monthly`}
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
          Pay annually and save 20%: $470/yr (Solo), $758/yr (Team), $1,238/yr (Business). Need
          more reps? Add-on seats are $39/user/mo ($374/yr annually) on Team and $19/user/mo
          ($182/yr annually) on Business. Solo accounts upgrade to Team to add a second rep.
        </p>
      </div>
    </section>
  );
}
