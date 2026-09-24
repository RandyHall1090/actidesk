import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getAuthorizationUrl, isAllowedReturnOrigin, signState } from "@/lib/integrations/outlook/oauth";

// Any active rep connects their own mailbox -- not an admin-only, org-wide
// setting (see plans/2026-09-24-per-rep-outlook-and-in-outlook-experience.md).
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return new Response("Sign in to connect Outlook.", { status: 401 });
  }

  // The rep's session cookie lives on this host; /finish must come back
  // here to check it, even though Microsoft's callback lands on the single
  // registered redirect host.
  const returnOrigin = request.nextUrl.origin;
  if (!isAllowedReturnOrigin(returnOrigin)) {
    return new Response("Unrecognized host.", { status: 400 });
  }

  redirect(getAuthorizationUrl(signState({ userId: profile.id, returnOrigin })));
}
