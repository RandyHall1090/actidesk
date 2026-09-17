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

  return <BillingClient org={org} />;
}
