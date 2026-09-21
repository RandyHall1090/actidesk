import { createHmac, randomBytes, timingSafeEqual, createHash } from "crypto";
import { getSiteUrl } from "@/lib/env";

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPES = "offline_access Contacts.Read Mail.Send User.Read";
const STATE_TTL_MS = 10 * 60 * 1000;

export type OutlookTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
};

function redirectUri(): string {
  return `${getSiteUrl()}/api/integrations/outlook/callback`;
}

/**
 * Domain-separated from INTEGRATIONS_ENCRYPTION_KEY's use as an AES key --
 * this only ever signs, never encrypts, so reusing the raw key bytes
 * directly (rather than minting a whole separate secret/env var) is safe
 * as long as the two uses can never be confused for each other.
 */
function stateSigningKey(): Buffer {
  const key = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!key) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(Buffer.from(key, "base64")).update("oauth-state").digest();
}

/**
 * Signs orgId into an opaque, expiring, tamper-evident state token.
 *
 * Found 2026-09-21 during a full security sweep: the callback previously
 * trusted Microsoft's echoed-back `state` query param as the org_id
 * directly, with no verification at all. Since `state` is fully
 * attacker-choosable (anyone can run the authorize step themselves with
 * any Microsoft account, then hand-craft the callback URL), that let
 * anyone with *any* ActiDesk session plant their own Microsoft OAuth
 * tokens as another org's Outlook integration -- silently redirecting
 * that org's contact imports and outbound "send via Outlook" mail through
 * the attacker's own Microsoft account. Signing + verifying closes it.
 */
export function signState(orgId: string): string {
  const nonce = randomBytes(9).toString("base64url");
  const expires = Date.now() + STATE_TTL_MS;
  const payload = `${orgId}.${expires}.${nonce}`;
  const signature = createHmac("sha256", stateSigningKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Verifies a signState() token; returns the orgId only if intact and unexpired. */
export function verifyState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [orgId, expiresStr, nonce, signature] = parts;
  const payload = `${orgId}.${expiresStr}.${nonce}`;
  const expected = createHmac("sha256", stateSigningKey()).update(payload).digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;

  return orgId;
}

/** Builds the URL to send the admin to for Microsoft's consent screen. */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<OutlookTokens> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      ...body,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft token endpoint failed: ${response.status} ${text}`);
  }
  const json = await response.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };
}

export function exchangeCodeForTokens(code: string): Promise<OutlookTokens> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    scope: SCOPES,
  });
}

export function refreshTokens(refreshToken: string): Promise<OutlookTokens> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES,
  });
}
