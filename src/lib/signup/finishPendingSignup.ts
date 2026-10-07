import { createClient } from "@/lib/supabase/server";
import { syncOrgSeatCount } from "@/lib/stripe/seatSync";
import { linkCheckoutSession } from "@/app/signup/actions";

// When Supabase requires email confirmation, signUp() returns no session, so
// the signup page can't run complete_signup() -- the new user confirms,
// signs in, and has an auth account but no profile or org. The signup page
// stores what it collected on the auth user's metadata; this finishes the
// job on their first authenticated request.
//
// Join-vs-create is decided here from the confirmed email's domain, never
// from metadata (which the user can edit): metadata only supplies the new
// org's name and a pre-signup checkout session id, both of which are
// harmless if tampered with -- the name is their own org's, and
// linkCheckoutSession verifies the payment email matches the account.
export async function finishPendingSignup(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) return false;

  const { data: match } = await supabase.rpc("find_org_by_email_domain", { p_email: user.email });
  const action: "join" | "create" = match?.[0] ? "join" : "create";
  const metadata = user.user_metadata ?? {};
  const companyName =
    typeof metadata.signup_company === "string" && metadata.signup_company.trim()
      ? metadata.signup_company.trim()
      : user.email.split("@")[1];

  const { data: profile, error } = await supabase.rpc("complete_signup", {
    p_action: action,
    p_company_name: action === "create" ? companyName : null,
  });
  if (error) {
    // A concurrent request may have finished it first; the caller re-reads
    // the profile either way.
    console.error("finishPendingSignup failed:", error.message);
    return false;
  }

  if (action === "join" && profile?.org_id) {
    await syncOrgSeatCount(profile.org_id);
  }
  if (action === "create" && typeof metadata.signup_checkout_session === "string") {
    const linked = await linkCheckoutSession(metadata.signup_checkout_session);
    if (!linked.ok) console.warn("Could not link checkout session:", linked.error);
  }
  return true;
}
