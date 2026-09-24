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

// Hosts this one deployment answers on. returnOrigin must be one of them --
// it's where the callback sends the rep's browser next, so an unchecked
// value would be an open redirect.
const APP_ORIGINS = new Set([
  "https://www.actidesk.ai",
  "https://app.actidesk.ai",
  "https://premeeting.actiforge.ai",
]);

export function isAllowedReturnOrigin(origin: string): boolean {
  if (APP_ORIGINS.has(origin) || origin === getSiteUrl()) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin);
}

export type OAuthState = { userId: string; returnOrigin: string };

/**
 * Signs the connecting rep's id and the host they started on into an
 * opaque, expiring, tamper-evident state token.
 *
 * Found 2026-09-21 during a full security sweep: the callback previously
 * trusted Microsoft's echoed-back `state` query param directly, with no
 * verification at all. Since `state` is fully attacker-choosable, that let
 * anyone plant their own Microsoft tokens as someone else's connection.
 * Signing closes forgery; /finish (which requires the same rep's live
 * session) closes a genuine state being completed in someone else's
 * browser.
 */
export function signState(data: OAuthState): string {
  const payload = Buffer.from(
    JSON.stringify({ ...data, exp: Date.now() + STATE_TTL_MS, n: randomBytes(9).toString("base64url") }),
  ).toString("base64url");
  const signature = createHmac("sha256", stateSigningKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Verifies a signState() token; returns its data only if intact, unexpired, and well-formed. */
export function verifyState(state: string): OAuthState | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", stateSigningKey()).update(payload).digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      returnOrigin?: unknown;
      exp?: unknown;
    };
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    if (typeof data.userId !== "string" || typeof data.returnOrigin !== "string") return null;
    if (!isAllowedReturnOrigin(data.returnOrigin)) return null;
    return { userId: data.userId, returnOrigin: data.returnOrigin };
  } catch {
    return null;
  }
}

/** Builds the URL to send the rep to for Microsoft's consent screen. */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: SCOPES,
    state,
    // A rep signed into several Microsoft accounts picks the one they send
    // from, instead of silently getting whichever the browser used last.
    prompt: "select_account",
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
