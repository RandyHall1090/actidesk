import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations/crypto";
import { refreshTokens, type OutlookTokens } from "@/lib/integrations/outlook/oauth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class OutlookNotConnectedError extends Error {
  constructor() {
    super("Connect your Outlook from your Account page first.");
    this.name = "OutlookNotConnectedError";
  }
}

/**
 * Returns a currently-valid access token for this rep's own connected
 * mailbox, refreshing (and re-persisting the new encrypted tokens) if the
 * stored one has expired. Keyed by user, never org: Graph's /me/* calls run
 * as whoever consented, so an org-shared token would send every rep's mail
 * as one person.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("outlook_connections")
    .select("encrypted_credentials")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row?.encrypted_credentials) throw new OutlookNotConnectedError();

  let tokens = decryptCredentials<OutlookTokens>(row.encrypted_credentials);
  if (Date.now() >= tokens.expires_at - 60_000) {
    tokens = await refreshTokens(tokens.refresh_token);
    await supabase
      .from("outlook_connections")
      .update({ encrypted_credentials: encryptCredentials(tokens), updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
  return tokens.access_token;
}

/** Who a freshly-issued token belongs to -- read once at connect time. */
export async function fetchMicrosoftProfile(
  accessToken: string,
): Promise<{ microsoftUserId: string; mailboxEmail: string }> {
  const response = await fetch(`${GRAPH_BASE}/me?$select=id,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Graph /me failed: ${response.status}`);
  }
  const me = (await response.json()) as { id: string; mail: string | null; userPrincipalName: string };
  return { microsoftUserId: me.id, mailboxEmail: me.mail ?? me.userPrincipalName };
}

export async function listOutlookContacts(
  userId: string,
): Promise<{ id: string; name: string; email: string }[]> {
  const accessToken = await getValidAccessToken(userId);
  const response = await fetch(
    `${GRAPH_BASE}/me/contacts?$select=displayName,emailAddresses&$top=200`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Graph contacts fetch failed: ${response.status}`);
  }
  const json = await response.json();
  return (json.value ?? [])
    .filter((c: { emailAddresses?: { address: string }[] }) => c.emailAddresses?.[0]?.address)
    .map((c: { id: string; displayName: string; emailAddresses: { address: string }[] }) => ({
      id: c.id,
      name: c.displayName,
      email: c.emailAddresses[0].address,
    }));
}

export async function sendViaOutlook(
  userId: string,
  message: { to: string; subject: string; html: string },
): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  const response = await fetch(`${GRAPH_BASE}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: { contentType: "HTML", content: message.html },
        toRecipients: [{ emailAddress: { address: message.to } }],
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Graph sendMail failed: ${response.status} ${text}`);
  }
}

/** The rep's connection summary for display -- never the tokens. */
export async function getOutlookConnection(
  userId: string,
): Promise<{ mailboxEmail: string; connectedAt: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("outlook_connections")
    .select("mailbox_email, connected_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { mailboxEmail: data.mailbox_email, connectedAt: data.connected_at } : null;
}
