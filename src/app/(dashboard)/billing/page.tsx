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
    .select("subscription_status, trial_ends_at, billing_exempt, billing_tier")
    .eq("id", profile.org_id)
    .single();

  // react-hooks/purity flags Date.now() during render, but that rule
  // protects the React Compiler's client-side memoization -- this is a
  // Server Component, dynamically rendered fresh per request with no
  // memoization involved, so "now" genuinely is the correct request-time
  // value to compute here and hand down as a plain prop.
  // eslint-disable-next-line react-hooks/purity
  return <BillingClient org={org} now={Date.now()} />;
}
