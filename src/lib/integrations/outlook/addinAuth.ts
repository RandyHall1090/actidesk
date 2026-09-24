import { createRemoteJWKSet, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/profile";

// The Outlook add-in signs reps in with Microsoft's nested app
// authentication (no ActiDesk password in Outlook, and Outlook's embedded
// browser doesn't carry the web app's session cookie anyway). It sends an
// access token for this app's own API scope; this file verifies it and maps
// it to a rep through the Outlook connection they made on their Account
// page -- no connection, no access.

export const ADDIN_SCOPE_NAME = "access_as_user";

export function addinApiScope(clientId: string): string {
  return `api://${clientId}/${ADDIN_SCOPE_NAME}`;
}

// Tenant-independent keys: the app is multi-tenant ("common"), so tokens
// arrive from every customer's own Microsoft 365 tenant.
const MICROSOFT_JWKS = createRemoteJWKSet(
  new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"),
);

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the token's Microsoft user id (oid, which equals Graph /me id)
 * only if it is a genuine, unexpired access token for this app's own API
 * scope, requested by this app itself. Never trusts an ID token.
 */
export async function verifyAddinAccessToken(token: string): Promise<{ oid: string } | null> {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  if (!clientId) throw new Error("OUTLOOK_CLIENT_ID is not set");

  try {
    const { payload } = await jwtVerify(token, MICROSOFT_JWKS, {
      audience: [clientId, `api://${clientId}`],
      algorithms: ["RS256"],
      clockTolerance: 60,
    });

    const { tid, oid } = payload as { tid?: unknown; oid?: unknown };
    if (typeof tid !== "string" || !GUID.test(tid) || typeof oid !== "string" || !GUID.test(oid)) {
      return null;
    }
    // Multi-tenant: there's no single fixed issuer, so bind it to the
    // token's own tenant. v2 and v1 formats both accepted -- which one a
    // custom API scope gets depends on the app registration's token version.
    const acceptedIssuers = [`https://login.microsoftonline.com/${tid}/v2.0`, `https://sts.windows.net/${tid}/`];
    if (!acceptedIssuers.includes(payload.iss ?? "")) return null;

    // Issued to this same app (the add-in shares the app registration), not
    // to some other application that was granted this scope.
    const { azp, appid } = payload as { azp?: unknown; appid?: unknown };
    if ((azp ?? appid) !== clientId) return null;

    const scopes = typeof payload.scp === "string" ? payload.scp.split(" ") : [];
    if (!scopes.includes(ADDIN_SCOPE_NAME)) return null;

    return { oid };
  } catch {
    return null;
  }
}

export type AddinRep = {
  id: string;
  orgId: string;
  role: string;
  fullName: string | null;
  email: string | null;
};

export type AddinAuthFailure = "unauthenticated" | "not_connected" | "inactive";

/**
 * Resolves the rep behind an add-in API request. In production this is the
 * Microsoft access token only. Under `next dev` alone, a missing token falls
 * back to the web app's session cookie so the taskpane UI can be exercised
 * in a normal browser -- never in a production build, which is what every
 * Vercel deployment (preview included) runs.
 */
export async function getAddinRep(
  request: Request,
): Promise<{ ok: true; rep: AddinRep } | { ok: false; reason: AddinAuthFailure }> {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!bearer) {
    if (process.env.NODE_ENV === "development") {
      const profile = await getCurrentProfile();
      if (profile?.is_active) {
        return {
          ok: true,
          rep: { id: profile.id, orgId: profile.org_id, role: profile.role, fullName: profile.full_name, email: profile.email },
        };
      }
    }
    return { ok: false, reason: "unauthenticated" };
  }

  const verified = await verifyAddinAccessToken(bearer);
  if (!verified) return { ok: false, reason: "unauthenticated" };

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("outlook_connections")
    .select("user_id")
    .eq("microsoft_user_id", verified.oid)
    .maybeSingle();
  if (!connection) return { ok: false, reason: "not_connected" };

  const { data: profile } = await admin
    .from("profiles")
    .select("id, org_id, role, full_name, email, is_active")
    .eq("id", connection.user_id)
    .maybeSingle();
  if (!profile?.is_active) return { ok: false, reason: "inactive" };

  return {
    ok: true,
    rep: { id: profile.id, orgId: profile.org_id, role: profile.role, fullName: profile.full_name, email: profile.email },
  };
}

const FAILURE_STATUS: Record<AddinAuthFailure, number> = {
  unauthenticated: 401,
  not_connected: 403,
  inactive: 403,
};

export function addinAuthError(reason: AddinAuthFailure): Response {
  return Response.json({ error: reason }, { status: FAILURE_STATUS[reason] });
}
