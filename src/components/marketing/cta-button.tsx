import Link from "next/link";

export function ActiDeskCta({
  size = "default",
  className = "",
}: {
  size?: "default" | "compact";
  className?: string;
}) {
  const sizeClasses = size === "compact" ? "px-5 py-2 text-xs" : "px-8 py-3 text-sm";
  return (
    <Link
      href="/signup"
      className={`btn-angled inline-block bg-electric font-mono-brand font-medium uppercase tracking-wider text-ink hover:bg-electric/90 ${sizeClasses} ${className}`}
    >
      Get Started →
    </Link>
  );
}

// A real package built for the site -- see the live-example-* package in
// the database, whose notification markers are pre-set so visitor opens
// never email its rep or start follow-through.
const LIVE_EXAMPLE_PATH = "/s/live-example-816ca15209ffe15c0277";

/** Hero CTA pair: sign up (primary) or look at a real package first
 * (secondary), with the trial stated exactly as production runs it --
 * orgs.trial_ends_at defaults to 14 days and signup asks for no card. */
export function HeroCtas({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-4">
        <ActiDeskCta />
        <a
          href={LIVE_EXAMPLE_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block border border-steel-line px-8 py-3 font-mono-brand text-sm font-medium uppercase tracking-wider text-bone hover:border-electric"
        >
          See a live example
        </a>
      </div>
      <p className="mt-3 font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
        14-day free trial. No credit card needed.
      </p>
    </div>
  );
}
