import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials, decryptCredentials } from "@/lib/integrations/crypto";
import { refreshTokens, type OutlookTokens } from "@/lib/integrations/outlook/oauth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Returns a currently-valid access token for the org's connected Outlook
 * account, refreshing (and re-persisting the new encrypted tokens) if the
 * stored one has expired. Throws if the org has no Outlook integration.
 */
export async function getValidAccessToken(orgId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("integrations")
    .select("encrypted_credentials")
    .eq("org_id", orgId)
    .eq("provider", "outlook")
    .single();
  if (!row?.encrypted_credentials) {
    throw new Error("Outlook is not connected for this organization.");
  }

  let tokens = decryptCredentials<OutlookTokens>(row.encrypted_credentials);
  if (Date.now() >= tokens.expires_at - 60_000) {
    tokens = await refreshTokens(tokens.refresh_token);
    await supabase
      .from("integrations")
      .update({
        encrypted_credentials: encryptCredentials(tokens),
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", "outlook");
  }
  return tokens.access_token;
}

export async function listOutlookContacts(
  orgId: string,
): Promise<{ id: string; name: string; email: string }[]> {
  const accessToken = await getValidAccessToken(orgId);
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
  orgId: string,
  message: { to: string; subject: string; html: string },
): Promise<void> {
  const accessToken = await getValidAccessToken(orgId);
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
