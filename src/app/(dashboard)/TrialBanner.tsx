import Link from "next/link";
import type { Org } from "@/lib/org";

/**
 * T34 Task 6: surfaces the same subscription_status/trial_ends_at/
 * billing_exempt state requireActiveBilling() (src/lib/billing.ts) uses
 * to actually enforce the soft-block, so what a rep sees here always
 * matches what they can/can't do.
 */
export function TrialBanner({ org }: { org: Org }) {
  if (org.billing_exempt) return null;

  if (org.subscription_status === "trialing") {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86_400_000),
    );
    return (
      <div className="bg-blue-50 dark:bg-blue-950 px-4 py-2 text-center text-sm text-blue-800 dark:text-blue-300">
        Free trial -- {daysLeft} day{daysLeft === 1 ? "" : "s"} left.{" "}
        <Link href="/billing" className="font-semibold underline">
          Subscribe
        </Link>
      </div>
    );
  }

  if (org.subscription_status === "past_due" || org.subscription_status === "canceled") {
    return (
      <div className="bg-red-50 dark:bg-red-950 px-4 py-2 text-center text-sm text-red-800 dark:text-red-300">
        Billing needs attention -- new content is blocked until this is resolved.{" "}
        <Link href="/billing" className="font-semibold underline">
          Fix billing
        </Link>
      </div>
    );
  }

  return null;
}
