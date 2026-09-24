import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/profile";
import { decryptCredentials, encryptCredentials } from "@/lib/integrations/crypto";
import type { OutlookTokens } from "@/lib/integrations/outlook/oauth";

const PENDING_TTL_MS = 10 * 60 * 1000;

type PendingPayload = { tokens: OutlookTokens; microsoftUserId: string; mailboxEmail: string };

/**
 * Stores a pending Microsoft sign-in as the signed-in rep's connection --
 * only if this browser's session belongs to the rep who started it. That
 * binding is what stops a flow someone else started (a genuine, signed
 * state) from being completed with a victim's Microsoft account and landing
 * in the other person's ActiDesk account. Not on the middleware's public
 * list: a signed-out visitor is sent to /login instead of reaching here.
 */
export async function GET(request: NextRequest) {
  const done = (outcome: string) =>
    Response.redirect(new URL(`/account?outlook=${outcome}`, request.nextUrl.origin), 302);

  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) return done("error");

  const pendingId = request.nextUrl.searchParams.get("pending");
  if (!pendingId || !/^[0-9a-f-]{36}$/i.test(pendingId)) return done("error");

  const supabase = createAdminClient();
  const { data: pending } = await supabase
    .from("outlook_connection_pending")
    .select("id, user_id, encrypted_payload, created_at")
    .eq("id", pendingId)
    .maybeSingle();
  if (!pending) return done("expired");

  // Single use, whatever happens next.
  await supabase.from("outlook_connection_pending").delete().eq("id", pending.id);

  if (pending.user_id !== profile.id) return done("mismatch");
  if (Date.now() - new Date(pending.created_at).getTime() > PENDING_TTL_MS) return done("expired");

  const payload = decryptCredentials<PendingPayload>(pending.encrypted_payload);
  const { error } = await supabase.from("outlook_connections").upsert(
    {
      user_id: profile.id,
      org_id: profile.org_id,
      mailbox_email: payload.mailboxEmail,
      microsoft_user_id: payload.microsoftUserId,
      encrypted_credentials: encryptCredentials(payload.tokens),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  // Unique microsoft_user_id: this mailbox is already another ActiDesk
  // user's connection.
  if (error?.code === "23505") return done("in_use");
  if (error) {
    console.error("Storing Outlook connection failed:", error);
    return done("error");
  }
  return done("connected");
}
