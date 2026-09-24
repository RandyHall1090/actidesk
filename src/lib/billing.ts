import { createAdminClient } from "@/lib/supabase/admin";

const BLOCKED_MESSAGE =
  "Your organization's trial has ended or billing needs attention -- visit Billing to keep creating new content.";

/**
 * Soft-block check (T34): existing content -- including already-sent
 * /s/[slug] prospect pages, and anything a rep already created -- is
 * never affected. This only gates *new* creation. Returns null (not
 * blocked) for an active subscription, an in-window trial, or an exempt
 * org; returns a user-facing message otherwise.
 *
 * Service role, not the caller's session: the Outlook add-in's API calls
 * have no Supabase session at all, and a session-scoped lookup there would
 * find no org and fail open below -- silently skipping the gate. Every
 * caller passes the org_id of a server-verified profile, never client input.
 */
export async function requireActiveBilling(orgId: string): Promise<string | null> {
  const supabase = createAdminClient();
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
