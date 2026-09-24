import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, verifyState } from "@/lib/integrations/outlook/oauth";
import { fetchMicrosoftProfile } from "@/lib/integrations/outlook/graph";
import { encryptCredentials } from "@/lib/integrations/crypto";

const PENDING_TTL_MS = 10 * 60 * 1000;

/**
 * Microsoft's redirect lands here, on the one registered redirect host --
 * usually not the host the rep is signed in on, so there's no session to
 * check. It only verifies the signed state, trades the code for tokens,
 * and parks them in a pending row; /finish, back on the rep's own host,
 * decides whether they get stored (it requires the same rep's session).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const verified = state ? verifyState(state) : null;
  // An unverifiable state has no trustworthy return host -- fall back to
  // this callback's own host rather than anything the request supplied.
  const accountUrl = `${verified?.returnOrigin ?? url.origin}/account`;

  if (!verified) {
    return Response.redirect(`${accountUrl}?outlook=invalid_state`, 302);
  }
  if (!code) {
    // Microsoft sends error= instead of code= when the rep cancels consent.
    return Response.redirect(`${accountUrl}?outlook=cancelled`, 302);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { microsoftUserId, mailboxEmail } = await fetchMicrosoftProfile(tokens.access_token);

    const supabase = createAdminClient();
    await supabase
      .from("outlook_connection_pending")
      .delete()
      .lt("created_at", new Date(Date.now() - PENDING_TTL_MS).toISOString());

    const { data: pending, error } = await supabase
      .from("outlook_connection_pending")
      .insert({
        user_id: verified.userId,
        encrypted_payload: encryptCredentials({ tokens, microsoftUserId, mailboxEmail }),
      })
      .select("id")
      .single();
    if (error || !pending) throw new Error(error?.message ?? "pending insert failed");

    return Response.redirect(
      `${verified.returnOrigin}/api/integrations/outlook/finish?pending=${pending.id}`,
      302,
    );
  } catch (error) {
    console.error("Outlook OAuth callback failed:", error);
    return Response.redirect(`${accountUrl}?outlook=error`, 302);
  }
}
