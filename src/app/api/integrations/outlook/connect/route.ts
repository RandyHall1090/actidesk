import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getAuthorizationUrl, signState } from "@/lib/integrations/outlook/oauth";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return new Response("Only admins can connect integrations.", { status: 403 });
  }
  // state carries the org_id so the callback (which has no session context
  // of its own beyond what Microsoft echoes back) knows which org to
  // attach the resulting tokens to. Signed + expiring, not the bare id --
  // see oauth.ts's signState() for why.
  redirect(getAuthorizationUrl(signState(profile.org_id)));
}
