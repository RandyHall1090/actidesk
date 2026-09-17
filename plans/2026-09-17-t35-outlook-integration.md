# T35: Integrations Foundation + Outlook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tenant admin connect their org's Outlook account to ActiDesk, then let any rep either (a) create a personalized package for one contact directly from Outlook, or (b) bulk-generate personalized packages for a whole contact list ("list merge") and have Outlook itself send each email — while establishing a shared `integrations` foundation that HubSpot/Autotask/ConnectWise/generic will plug into later without a rework.

**Architecture:** A new per-org `integrations` table holds encrypted OAuth tokens/API keys, one row per org per connected provider. A Securafy-hosted Azure AD app registration lets any tenant's admin connect their own Outlook via a standard OAuth consent screen — Securafy never sees or stores the tenant's Microsoft password, only an encrypted access/refresh token pair. A provider-agnostic list-merge engine generates one real `packages` row per selected contact (independent creation path, same pattern T33's Gate Desk route already established, not a refactor of the existing dashboard create-package action); sending is always handed to the connected provider itself (Microsoft Graph `sendMail` for Outlook) — ActiDesk never sends prospect-facing email directly. An Outlook Add-in (a small separate mini-app: manifest + task pane) puts a "Create ActiDesk package" button directly in Outlook when viewing a contact or email.

**Tech Stack:** Microsoft identity platform (OAuth 2.0 authorization code flow, `/common` multi-tenant endpoint so both work/school and personal Microsoft accounts work) + Microsoft Graph API (`Contacts.Read`, `Mail.Send`, `User.Read`, `offline_access` delegated scopes) for the Outlook side; Node's built-in `crypto` (AES-256-GCM) for credential encryption — no new npm dependency needed for either.

**Spec:** `spec/plan.md` (T35 row + the Integrations Tech decisions bullet from this session's planning discussion) — this plan is the only detailed doc, per this repo's convention (see T29–T34).

## Global Constraints

- **`integrations` table**: one row per `(org_id, provider)`, `provider` restricted to `'outlook' | 'hubspot' | 'autotask' | 'connectwise' | 'generic'` by CHECK constraint (only `'outlook'` is actually wired up by this plan — the others exist as reserved values so later plans don't need a schema change to add themselves).
- **Credential encryption**: every credential blob is AES-256-GCM encrypted by the app (`src/lib/integrations/crypto.ts`) before it ever reaches Postgres. `INTEGRATIONS_ENCRYPTION_KEY` is a 32-byte, base64-encoded key — losing it means every stored token becomes permanently undecryptable (equivalent to every tenant having to reconnect).
- **Outlook never gets Securafy's own credentials** — every tenant's admin goes through their own Microsoft consent screen; Securafy only registers the Azure AD *app* (client ID/secret), never a tenant's actual Microsoft account.
- **Sending is always the provider's job** — this plan never calls any "send email" API of ActiDesk's own; Outlook packages are always sent via Microsoft Graph `sendMail` from the connected rep's own mailbox.
- **List-merge send mode is a per-run choice** (review-first vs. auto-send), never a fixed org-wide setting — a toggle on the list-merge screen itself.
- **Package creation for this feature is a new, independent path** (`src/lib/integrations/createPackageForContact.ts`), not a refactor of the existing `packages/new/actions.ts` create-package action — matches the precedent already set by T33's Gate Desk route, and avoids any risk of regressing the existing, already-verified dashboard create flow.
- **No test framework in this repo** — every task verifies via real manual/CLI checks (Supabase SQL, a real Microsoft test account, a real browser), matching T29–T34's convention.
- **Env vars**: `INTEGRATIONS_ENCRYPTION_KEY`, `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET` — all added to `.env.local` and `.env.example`. Named `OUTLOOK_*` (not a generic `CLIENT_ID`/`CLIENT_SECRET`) specifically to avoid the kind of silent env-var collision found earlier this project with `HUBSPOT_PRIVATE_APP_TOKEN`.
- **This plan does not publish the Outlook Add-in to Microsoft AppSource** — it ships as a manifest Randy sideloads for testing/internal use (Outlook → Get Add-ins → My add-ins → Add custom add-in → Add from file). Public marketplace listing is a future step with its own review process, not in scope here.

---

### Task 1: `integrations`/`integration_requests` tables + credential encryption helper

**Files:**
- Create: `supabase/migrations/0030_integrations.sql`
- Create: `src/lib/integrations/crypto.ts`

**Interfaces:**
- Produces: `integrations` table (`org_id, provider, status, encrypted_credentials, connected_by, connected_at, updated_at`) and `integration_requests` table (`org_id, requested_by, provider_name, note, created_at`) — every later task reads/writes these exact columns.
- Produces: `encryptCredentials(data: unknown): string` and `decryptCredentials<T>(encoded: string): T` from `src/lib/integrations/crypto.ts` — Task 3's OAuth callback and Task 4's Graph client both import these, never construct their own cipher.

- [ ] **Step 1: Generate the encryption key**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add the output to `.env.local` as `INTEGRATIONS_ENCRYPTION_KEY=...` and add a blank placeholder + comment to `.env.example`:

```
# --- Integrations (T35) ---
# 32-byte, base64-encoded AES-256-GCM key. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Losing this key makes every stored integration credential permanently
# undecryptable -- back it up the same way you would a database password.
INTEGRATIONS_ENCRYPTION_KEY=
```

- [ ] **Step 2: Write the encryption helper**

```typescript
// src/lib/integrations/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!key) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return buf;
}

/**
 * Encrypts a JSON-serializable credentials object (e.g. an OAuth token
 * pair) into one opaque base64 string: iv (12 bytes) + GCM auth tag (16
 * bytes) + ciphertext, concatenated. Server-only -- never call from a
 * Client Component.
 */
export function encryptCredentials(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Reverses encryptCredentials. Throws if the key is wrong or the stored
 * value was tampered with (GCM's auth tag check fails closed).
 */
export function decryptCredentials<T = unknown>(encoded: string): T {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
```

- [ ] **Step 3: Write and apply the migration**

```sql
-- 0030_integrations.sql
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  provider text not null check (
    provider in ('outlook', 'hubspot', 'autotask', 'connectwise', 'generic')
  ),
  status text not null default 'connected' check (
    status in ('connected', 'disconnected', 'error')
  ),
  -- AES-256-GCM encrypted by the app (src/lib/integrations/crypto.ts)
  -- before it ever reaches this column -- never stored in plaintext.
  encrypted_credentials text,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create table public.integration_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  provider_name text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.integrations enable row level security;
alter table public.integration_requests enable row level security;

-- Every org member can see their own org's connection status (not the
-- decrypted credentials themselves -- decryptCredentials only ever runs
-- server-side against the service-role client, never exposed via a
-- SELECT this policy grants to a browser session).
create policy "integrations_select_own_org" on public.integrations
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Only an org's own admin can connect/disconnect an integration.
create policy "integrations_write_admin" on public.integrations
  for all using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy "integration_requests_insert_own_org" on public.integration_requests
  for insert with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Only Securafy's own cross-tenant platform admins triage requests --
-- matches the existing is_platform_admin() pattern used by /admin (T12).
create policy "integration_requests_select_platform_admin" on public.integration_requests
  for select using (public.is_platform_admin());

create index idx_integrations_org on public.integrations (org_id);
create index idx_integration_requests_org on public.integration_requests (org_id);
```

Apply via `mcp__supabase__apply_migration` (name: `integrations`).

- [ ] **Step 4: Verify live**

```sql
-- Confirm the encrypt/decrypt round-trip works from a plain Node script
-- (not through Postgres -- this is app-layer crypto):
```
```bash
node -e "
const { encryptCredentials, decryptCredentials } = require('./src/lib/integrations/crypto.ts');
" 2>&1 || echo "expected: run via ts-node/tsx, not plain node, since this is a .ts file"
npx tsx -e "
import { encryptCredentials, decryptCredentials } from './src/lib/integrations/crypto';
const enc = encryptCredentials({ access_token: 'test-123' });
console.log('encrypted:', enc);
console.log('decrypted:', decryptCredentials(enc));
"
```
Expect the decrypted output to exactly match `{ access_token: 'test-123' }`. Then confirm the migration via SQL:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('integrations', 'integration_requests');
-- Expect both rows present
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0030_integrations.sql src/lib/integrations/crypto.ts .env.example
git commit -m "feat: add integrations table and credential encryption helper"
```

---

### Task 2: Integrations settings page (shell, connect status, request-an-integration)

**Files:**
- Create: `src/app/(dashboard)/integrations/page.tsx`
- Create: `src/app/(dashboard)/integrations/IntegrationsClient.tsx`
- Create: `src/app/(dashboard)/integrations/actions.ts`
- Modify: dashboard nav (add an admin-only "Integrations" link, same visibility pattern as "Team"/"Billing")

**Interfaces:**
- Consumes: `getCurrentProfile()` (existing).
- Produces: `requestIntegration(providerName: string, note: string): Promise<{ ok: boolean; error?: string }>` from `src/app/(dashboard)/integrations/actions.ts` — consumed by `IntegrationsClient.tsx` in this task; `connectOutlook()`/`disconnectIntegration(provider)` are added to this same file in Task 3, not yet in this task.

- [ ] **Step 1: Write the page (server component, fetches connection status)**

```tsx
// src/app/(dashboard)/integrations/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, status, connected_at")
    .eq("org_id", profile.org_id);

  return <IntegrationsClient integrations={integrations ?? []} />;
}
```

- [ ] **Step 2: Write the client component (provider list + request form)**

```tsx
// src/app/(dashboard)/integrations/IntegrationsClient.tsx
"use client";

import { useState } from "react";
import { requestIntegration } from "./actions";

const PROVIDERS = [
  { id: "outlook", label: "Outlook", available: true },
  { id: "hubspot", label: "HubSpot", available: false },
  { id: "autotask", label: "Autotask", available: false },
  { id: "connectwise", label: "ConnectWise Manage", available: false },
  { id: "generic", label: "Generic (webhook/API key)", available: false },
] as const;

type Integration = { provider: string; status: string; connected_at: string };

export function IntegrationsClient({ integrations }: { integrations: Integration[] }) {
  const [requestNote, setRequestNote] = useState("");
  const [requestTarget, setRequestTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const byProvider = new Map(integrations.map((i) => [i.provider, i]));

  async function handleRequest(providerName: string) {
    const result = await requestIntegration(providerName, requestNote);
    setMessage(result.ok ? "Request sent -- thanks!" : (result.error ?? "Something went wrong."));
    setRequestTarget(null);
    setRequestNote("");
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Integrations
      </h2>
      {message && <p className="mt-2 text-sm text-blue-600">{message}</p>}
      <ul className="mt-4 space-y-3">
        {PROVIDERS.map((provider) => {
          const connected = byProvider.get(provider.id);
          return (
            <li
              key={provider.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 dark:border-neutral-700 p-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {provider.label}
                </p>
                <p className="text-xs text-neutral-500">
                  {connected ? `Connected ${new Date(connected.connected_at).toLocaleDateString()}` : "Not connected"}
                </p>
              </div>
              {provider.available ? (
                <a
                  href={connected ? undefined : "/api/integrations/outlook/connect"}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {connected ? "Connected" : "Connect"}
                </a>
              ) : requestTarget === provider.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Optional note"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => handleRequest(provider.label)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setRequestTarget(provider.id)}
                  className="text-sm text-blue-600 underline"
                >
                  Request this integration
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Write the request action**

```typescript
// src/app/(dashboard)/integrations/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

export async function requestIntegration(
  providerName: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("integration_requests").insert({
    org_id: profile.org_id,
    requested_by: profile.id,
    provider_name: providerName.slice(0, 200),
    note: note.slice(0, 1000) || null,
  });

  if (error) {
    console.error("integration request insert failed:", error);
    return { ok: false, error: "Could not send the request." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Add the nav link**

Find the existing admin-only nav links (Team/Billing) in the dashboard layout/nav component and add an "Integrations" link to `/integrations`, same visibility condition (`profile.role === "admin"`).

- [ ] **Step 5: Verify live**

Log in as an admin, visit `/integrations`, confirm all 5 providers list with correct "Not connected" status; request the "HubSpot" integration with a note, confirm the success message and a real row in `integration_requests` (query it directly). Log in as a non-admin rep, confirm `/integrations` redirects away.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/integrations"
git commit -m "feat: add Integrations settings page shell + request-an-integration"
```

---

### Task 3: Outlook OAuth connect flow (Azure AD app registration + callback)

**Files:**
- Create: `src/lib/integrations/outlook/oauth.ts`
- Create: `src/app/api/integrations/outlook/connect/route.ts`
- Create: `src/app/api/integrations/outlook/callback/route.ts`

**Interfaces:**
- Consumes: `encryptCredentials`/`decryptCredentials` (Task 1).
- Produces: `getAuthorizationUrl(state: string): string` and `exchangeCodeForTokens(code: string): Promise<OutlookTokens>` from `src/lib/integrations/outlook/oauth.ts`, where `OutlookTokens = { access_token: string; refresh_token: string; expires_at: number }` — Task 4's Graph client consumes this exact shape when it decrypts a stored row.

- [ ] **Step 1: Register the Azure AD app (manual, Randy's action)**

At https://portal.azure.com → Azure Active Directory → App registrations → New registration:
- Name: "ActiDesk"
- Supported account types: "Accounts in any organizational directory and personal Microsoft accounts" (multi-tenant + personal -- matches this app's own multi-tenant model, so any customer's Outlook/Microsoft 365 account can connect)
- Redirect URI (Web): `https://<your-production-domain>/api/integrations/outlook/callback` (add `http://localhost:3000/api/integrations/outlook/callback` too, as a second Web redirect URI, for local testing)

Then: Certificates & secrets → New client secret → record the value immediately (shown once). API permissions → Add a permission → Microsoft Graph → Delegated permissions → add `Contacts.Read`, `Mail.Send`, `User.Read`, `offline_access`.

Record the Application (client) ID and the client secret value.

- [ ] **Step 2: Add env vars**

```
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
```

Add both (blank) to `.env.example` with a comment referencing this step, and the real values to `.env.local`.

- [ ] **Step 3: Write the OAuth helper**

```typescript
// src/lib/integrations/outlook/oauth.ts
const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPES = "offline_access Contacts.Read Mail.Send User.Read";

export type OutlookTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
};

function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/outlook/callback`;
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
```

- [ ] **Step 4: Write the connect route (admin-only, starts the OAuth flow)**

```typescript
// src/app/api/integrations/outlook/connect/route.ts
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getAuthorizationUrl } from "@/lib/integrations/outlook/oauth";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return new Response("Only admins can connect integrations.", { status: 403 });
  }
  // state carries the org_id so the callback (which has no session context
  // of its own beyond what Microsoft echoes back) knows which org to
  // attach the resulting tokens to.
  redirect(getAuthorizationUrl(profile.org_id));
}
```

- [ ] **Step 5: Write the callback route**

```typescript
// src/app/api/integrations/outlook/callback/route.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/integrations/outlook/oauth";
import { encryptCredentials } from "@/lib/integrations/crypto";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const orgId = url.searchParams.get("state");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  if (!code || !orgId) {
    return Response.redirect(`${siteUrl}/integrations?error=missing_code`, 302);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const supabase = createAdminClient();
    await supabase.from("integrations").upsert(
      {
        org_id: orgId,
        provider: "outlook",
        status: "connected",
        encrypted_credentials: encryptCredentials(tokens),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" },
    );
    return Response.redirect(`${siteUrl}/integrations?connected=outlook`, 302);
  } catch (error) {
    console.error("Outlook OAuth callback failed:", error);
    return Response.redirect(`${siteUrl}/integrations?error=outlook_connect_failed`, 302);
  }
}
```

- [ ] **Step 6: Verify live**

As an admin, click "Connect" next to Outlook on `/integrations`; confirm it redirects to a real Microsoft consent screen listing Contacts/Mail permissions. Sign in with a real test Microsoft account and approve; confirm redirect back to `/integrations?connected=outlook` and a real row in `integrations` (query it -- `encrypted_credentials` should be a long opaque base64 string, not readable tokens).

- [ ] **Step 7: Commit**

```bash
git add src/lib/integrations/outlook/oauth.ts "src/app/api/integrations/outlook" .env.example
git commit -m "feat: add Outlook OAuth connect/callback flow"
```

---

### Task 4: Outlook Graph client (token refresh, contact list, single-contact package creation)

**Files:**
- Create: `src/lib/integrations/outlook/graph.ts`
- Create: `src/lib/integrations/createPackageForContact.ts`
- Modify: `src/app/(dashboard)/integrations/actions.ts` (add `createOutlookPackage`)

**Interfaces:**
- Consumes: `decryptCredentials`, `encryptCredentials` (Task 1); `refreshTokens` (Task 3).
- Produces: `getValidAccessToken(orgId: string): Promise<string>` and `listOutlookContacts(orgId: string): Promise<{ id: string; name: string; email: string }[]>` from `src/lib/integrations/outlook/graph.ts` -- Task 5 (list-merge) and Task 6 (send) both consume these.
- Produces: `createPackageForContact(input: { orgId: string; createdBy: string; prospectName: string; prospectEmail?: string; prospectCompany?: string; templateId: string }): Promise<{ slug: string; url: string }>` from `src/lib/integrations/createPackageForContact.ts` -- an independent creation path (see Global Constraints), consumed by this task's single-contact action and Task 5's list-merge loop.

- [ ] **Step 1: Write the package-creation helper**

```typescript
// src/lib/integrations/createPackageForContact.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify, randomSuffix } from "@/lib/packages/slug";

/**
 * Independent package-creation path for integration-originated packages
 * (Outlook today, other providers later) -- deliberately not a call into
 * packages/new/actions.ts's savePackage, matching the precedent T33's
 * Gate Desk route already established: a shared refactor of the
 * existing, already-verified dashboard create-package action carries
 * more regression risk than a small independent path with its own
 * slug-collision retry loop.
 */
export async function createPackageForContact(input: {
  orgId: string;
  createdBy: string;
  prospectName: string;
  prospectEmail?: string;
  prospectCompany?: string;
  templateId: string;
}): Promise<{ slug: string; url: string }> {
  const supabase = createAdminClient();
  const base = slugify(input.prospectName);

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("packages")
      .insert({
        org_id: input.orgId,
        created_by: input.createdBy,
        slug,
        prospect_name: input.prospectName,
        prospect_email: input.prospectEmail ?? null,
        prospect_company: input.prospectCompany ?? null,
        template_id: input.templateId,
      })
      .select("slug")
      .single();

    if (!error && data) {
      return { slug: data.slug, url: `${process.env.NEXT_PUBLIC_SITE_URL}/s/${data.slug}` };
    }
    // Unique-violation on slug -- retry with a fresh suffix; any other
    // error is real and should surface, not be silently retried.
    if (error && error.code !== "23505") {
      throw new Error(`Package creation failed: ${error.message}`);
    }
  }
  throw new Error("Could not generate a unique slug after 3 attempts.");
}
```

Confirm `slugify`/`randomSuffix` are already exported from `src/lib/packages/slug.ts` (they are, per T33/the earlier slug-security fix this session) before writing this -- no changes needed there.

- [ ] **Step 2: Write the Graph client**

```typescript
// src/lib/integrations/outlook/graph.ts
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
```

- [ ] **Step 3: Add the single-contact create action**

```typescript
// added to src/app/(dashboard)/integrations/actions.ts
import { getCurrentProfile } from "@/lib/profile";
import { listOutlookContacts } from "@/lib/integrations/outlook/graph";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";

export async function createOutlookPackage(
  contactId: string,
  templateId: string,
): Promise<{ url: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const contacts = await listOutlookContacts(profile.org_id);
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) return { error: "Contact not found." };

  const result = await createPackageForContact({
    orgId: profile.org_id,
    createdBy: profile.id,
    prospectName: contact.name,
    prospectEmail: contact.email,
    templateId,
  });
  return { url: result.url };
}
```

- [ ] **Step 4: Verify live**

With a real connected test Outlook account that has at least one contact: call `listOutlookContacts` (temporarily log its result, or exercise via a quick manual test page) and confirm real contact names/emails come back. Call `createOutlookPackage` with one real contact ID, confirm a real `packages` row is created with `created_by` set to the calling rep and the correct `org_id`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/outlook/graph.ts src/lib/integrations/createPackageForContact.ts "src/app/(dashboard)/integrations/actions.ts"
git commit -m "feat: add Outlook Graph client and single-contact package creation"
```

---

### Task 5: List-merge engine (provider-agnostic core + Outlook picker UI)

**Files:**
- Create: `src/app/(dashboard)/integrations/list-merge/page.tsx`
- Create: `src/app/(dashboard)/integrations/list-merge/ListMergeClient.tsx`
- Create: `src/app/(dashboard)/integrations/list-merge/actions.ts`
- Create: `src/lib/integrations/mergeFields.ts`

**Interfaces:**
- Consumes: `listOutlookContacts` (Task 4), `createPackageForContact` (Task 4).
- Produces: `applyMergeFields(template: string, contact: { name: string; email: string; company?: string }): string` from `src/lib/integrations/mergeFields.ts` -- consumed by this task's generate step and Task 6's send step.
- Produces: `generateListMerge(input: { contactIds: string[]; templateId: string; letterTemplate: string }): Promise<{ slug: string; url: string; contactName: string; contactEmail: string }[]>` from `src/app/(dashboard)/integrations/list-merge/actions.ts` -- consumed by `ListMergeClient.tsx` in this task and by Task 6's send actions.

- [ ] **Step 1: Write the merge-field helper**

```typescript
// src/lib/integrations/mergeFields.ts
/**
 * Replaces {{first_name}}, {{company}}, {{full_name}} tokens in a letter
 * template with a specific contact's real values. Unknown tokens are left
 * as-is (visibly wrong, not silently dropped) rather than guessed at.
 */
export function applyMergeFields(
  template: string,
  contact: { name: string; email: string; company?: string },
): string {
  const firstName = contact.name.split(" ")[0] ?? contact.name;
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{full_name}}", contact.name)
    .replaceAll("{{company}}", contact.company ?? "");
}
```

- [ ] **Step 2: Write the list-merge generation action**

```typescript
// src/app/(dashboard)/integrations/list-merge/actions.ts
"use server";

import { getCurrentProfile } from "@/lib/profile";
import { listOutlookContacts } from "@/lib/integrations/outlook/graph";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";

export async function fetchOutlookContactsForMerge() {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  return listOutlookContacts(profile.org_id);
}

export async function generateListMerge(input: {
  contactIds: string[];
  templateId: string;
}): Promise<
  { slug: string; url: string; contactName: string; contactEmail: string }[]
> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const contacts = await listOutlookContacts(profile.org_id);
  const selected = contacts.filter((c) => input.contactIds.includes(c.id));

  const results = [];
  for (const contact of selected) {
    const { slug, url } = await createPackageForContact({
      orgId: profile.org_id,
      createdBy: profile.id,
      prospectName: contact.name,
      prospectEmail: contact.email,
      templateId: input.templateId,
    });
    results.push({ slug, url, contactName: contact.name, contactEmail: contact.email });
  }
  return results;
}
```

- [ ] **Step 3: Write the picker/generate UI**

```tsx
// src/app/(dashboard)/integrations/list-merge/ListMergeClient.tsx
"use client";

import { useEffect, useState } from "react";
import { fetchOutlookContactsForMerge, generateListMerge } from "./actions";
import { sendListMerge } from "./send-actions"; // added in Task 6

type Contact = { id: string; name: string; email: string };
type Generated = { slug: string; url: string; contactName: string; contactEmail: string };

export function ListMergeClient({ templateId }: { templateId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [letterTemplate, setLetterTemplate] = useState(
    "Hi {{first_name}},\n\nThought you'd enjoy this.\n",
  );
  const [reviewFirst, setReviewFirst] = useState(true);
  const [generated, setGenerated] = useState<Generated[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchOutlookContactsForMerge().then(setContacts);
  }, []);

  async function handleGenerate() {
    setStatus("Generating packages...");
    const results = await generateListMerge({ contactIds: selected, templateId });
    setGenerated(results);
    if (!reviewFirst) {
      setStatus("Sending...");
      await sendListMerge({ letterTemplate, items: results });
      setStatus(`Sent ${results.length} email(s).`);
    } else {
      setStatus(`Generated ${results.length} package(s) -- review and send below.`);
    }
  }

  async function handleSendAll() {
    if (!generated) return;
    setStatus("Sending...");
    await sendListMerge({ letterTemplate, items: generated });
    setStatus(`Sent ${generated.length} email(s).`);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        List Merge (Outlook)
      </h2>

      <ul className="mt-4 max-h-64 overflow-y-auto space-y-1">
        {contacts.map((c) => (
          <li key={c.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                  )
                }
              />
              {c.name} ({c.email})
            </label>
          </li>
        ))}
      </ul>

      <textarea
        value={letterTemplate}
        onChange={(e) => setLetterTemplate(e.target.value)}
        rows={4}
        className="mt-4 w-full rounded-md border border-neutral-300 p-2 text-sm"
      />

      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={reviewFirst}
          onChange={(e) => setReviewFirst(e.target.checked)}
        />
        Review before sending
      </label>

      {status && <p className="mt-2 text-sm text-blue-600">{status}</p>}

      <button
        onClick={handleGenerate}
        disabled={selected.length === 0}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Generate {selected.length} package(s)
      </button>

      {reviewFirst && generated && (
        <div className="mt-4">
          <ul className="space-y-1 text-sm">
            {generated.map((g) => (
              <li key={g.slug}>
                {g.contactName}: <a href={g.url} className="underline">{g.url}</a>
              </li>
            ))}
          </ul>
          <button
            onClick={handleSendAll}
            className="mt-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Send All
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

```tsx
// src/app/(dashboard)/integrations/list-merge/page.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { ListMergeClient } from "./ListMergeClient";

export default async function ListMergePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return <ListMergeClient templateId="desk-v1" />;
}
```

(Template selection is hardcoded to `desk-v1` for this first pass -- a template picker dropdown is a small, obvious follow-up once this path is proven, not deferred for any technical reason.)

- [ ] **Step 5: Verify live**

As a rep with Outlook connected, visit `/integrations/list-merge`, confirm real contacts load, select 2, generate with "Review before sending" checked -- confirm 2 real packages appear with working links, and nothing has been emailed yet (check the test mailbox). This task's send button is wired in Task 6 -- for now, confirm generation alone works end-to-end.

- [ ] **Step 6: Commit**

```bash
git add src/lib/integrations/mergeFields.ts "src/app/(dashboard)/integrations/list-merge"
git commit -m "feat: add provider-agnostic list-merge generation (Outlook contacts)"
```

---

### Task 6: Send via Outlook (Graph `sendMail`, single + list-merge)

**Files:**
- Create: `src/lib/integrations/outlook/graph.ts` (add `sendViaOutlook`)
- Create: `src/app/(dashboard)/integrations/list-merge/send-actions.ts`
- Modify: `src/app/(dashboard)/integrations/actions.ts` (single-contact send)

**Interfaces:**
- Consumes: `getValidAccessToken` (Task 4).
- Produces: `sendViaOutlook(orgId: string, message: { to: string; subject: string; html: string }): Promise<void>` -- added to `src/lib/integrations/outlook/graph.ts`, consumed by `sendListMerge` (this task) and any future single-contact "send now" action.
- Produces: `sendListMerge(input: { letterTemplate: string; items: { slug: string; url: string; contactName: string; contactEmail: string }[] }): Promise<void>` from `src/app/(dashboard)/integrations/list-merge/send-actions.ts` -- imported by `ListMergeClient.tsx` (Task 5, already referenced there as `send-actions`).

- [ ] **Step 1: Add `sendViaOutlook` to the Graph client**

```typescript
// added to src/lib/integrations/outlook/graph.ts
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
```

- [ ] **Step 2: Write the list-merge send action**

```typescript
// src/app/(dashboard)/integrations/list-merge/send-actions.ts
"use server";

import { getCurrentProfile } from "@/lib/profile";
import { sendViaOutlook } from "@/lib/integrations/outlook/graph";
import { applyMergeFields } from "@/lib/integrations/mergeFields";

export async function sendListMerge(input: {
  letterTemplate: string;
  items: { slug: string; url: string; contactName: string; contactEmail: string }[];
}): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;

  for (const item of input.items) {
    const body = applyMergeFields(input.letterTemplate, {
      name: item.contactName,
      email: item.contactEmail,
    });
    const html = `<p>${body.replaceAll("\n", "<br/>")}</p><p><a href="${item.url}">${item.url}</a></p>`;
    await sendViaOutlook(profile.org_id, {
      to: item.contactEmail,
      subject: "A quick personal note",
      html,
    });
  }
}
```

- [ ] **Step 3: Verify live**

Using a real connected test Outlook account and 2 real test-mailbox contacts: run the full list-merge flow with "Review before sending" checked, click "Send All", confirm both emails actually arrive in the test mailboxes with the correct merged first name and the correct personalized link, and confirm they show up in the connected account's own Sent Items (proving it truly sent from the rep's mailbox, not some other path). Then repeat once with "Review before sending" unchecked, confirming it sends immediately with no confirm step.

- [ ] **Step 4: Commit**

```bash
git add src/lib/integrations/outlook/graph.ts "src/app/(dashboard)/integrations/list-merge/send-actions.ts"
git commit -m "feat: send list-merge emails via Outlook Graph sendMail"
```

---

### Task 7: Outlook Add-in (task pane "Create ActiDesk package" button)

**Files:**
- Create: `public/outlook-addin/manifest.xml`
- Create: `src/app/outlook-addin/taskpane/page.tsx`

**Interfaces:**
- Consumes: `createOutlookPackage` (Task 4, via a fetch call from the task pane rather than a direct server action import, since the task pane runs inside Outlook's own webview, not this app's own React tree).

- [ ] **Step 1: Write the manifest**

```xml
<!-- public/outlook-addin/manifest.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:type="MailApp">
  <Id>a1b2c3d4-e5f6-4789-a123-456789abcdef</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>Securafy</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="ActiDesk" />
  <Description DefaultValue="Create a personalized ActiDesk package for the current contact." />
  <IconUrl DefaultValue="https://<your-production-domain>/favicon.ico" />
  <SupportUrl DefaultValue="https://<your-production-domain>/help" />
  <Hosts>
    <Host Name="Mailbox" />
  </Hosts>
  <Requirements>
    <Sets>
      <Set Name="Mailbox" MinVersion="1.5" />
    </Sets>
  </Requirements>
  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://<your-production-domain>/outlook-addin/taskpane" />
        <RequestedHeight>450</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadItem</Permissions>
</OfficeApp>
```

Replace every `<your-production-domain>` with the real deployed domain before sideloading.

- [ ] **Step 2: Write the task pane page**

```tsx
// src/app/outlook-addin/taskpane/page.tsx
"use client";

import { useEffect, useState } from "react";

declare const Office: {
  onReady: (callback: () => void) => void;
  context: { mailbox: { item: { from?: { emailAddress: string; displayName: string } } } };
};

export default function TaskpanePage() {
  const [contact, setContact] = useState<{ name: string; email: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
    script.onload = () => {
      Office.onReady(() => {
        const from = Office.context.mailbox.item.from;
        if (from) setContact({ name: from.displayName, email: from.emailAddress });
      });
    };
    document.body.appendChild(script);
  }, []);

  async function handleCreate() {
    if (!contact) return;
    setLoading(true);
    const response = await fetch("/api/integrations/outlook/taskpane-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: contact.name, email: contact.email }),
      credentials: "include",
    });
    const json = await response.json();
    setResult(json.url ?? json.error);
    setLoading(false);
  }

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <h3>ActiDesk</h3>
      {!contact && <p>Reading the current message...</p>}
      {contact && (
        <>
          <p>Create a package for <strong>{contact.name}</strong> ({contact.email})?</p>
          <button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create package"}
          </button>
        </>
      )}
      {result && (
        <p>
          Done: <a href={result} target="_blank" rel="noopener noreferrer">{result}</a>
        </p>
      )}
    </div>
  );
}
```

Note: the task pane calls a small new route `src/app/api/integrations/outlook/taskpane-create/route.ts` (a thin wrapper around `createPackageForContact`, auth'd via the rep's existing session cookie since the task pane loads inside the same browser/session as the rep's normal ActiDesk login) rather than importing the server action directly -- Office Add-in task panes are a separate document context, not part of this Next.js app's own React client tree.

```typescript
// src/app/api/integrations/outlook/taskpane-create/route.ts
import { getCurrentProfile } from "@/lib/profile";
import { createPackageForContact } from "@/lib/integrations/createPackageForContact";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Not signed in to ActiDesk." }, { status: 401 });

  const { name, email } = await req.json();
  if (!name) return Response.json({ error: "Missing contact name." }, { status: 400 });

  const result = await createPackageForContact({
    orgId: profile.org_id,
    createdBy: profile.id,
    prospectName: name,
    prospectEmail: email,
    templateId: "desk-v1",
  });
  return Response.json({ url: result.url });
}
```

- [ ] **Step 3: Sideload and verify live**

In Outlook (desktop or web): Get Add-ins → My add-ins → Add custom add-in → Add from file → select the real `manifest.xml` (with the real domain filled in). Open a real email, confirm the ActiDesk task pane button appears; click it, confirm the sender's name/email populate correctly, click "Create package", confirm a real package is created and the link is shown (requires being logged into ActiDesk in the same browser profile the task pane runs in).

- [ ] **Step 4: Commit**

```bash
git add public/outlook-addin src/app/outlook-addin "src/app/api/integrations/outlook/taskpane-create"
git commit -m "feat: add Outlook Add-in task pane for single-contact package creation"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Full flow, real test Microsoft account, real test mailboxes**

1. Admin connects Outlook from `/integrations` -- real consent screen, real token stored encrypted.
2. From the sideloaded Outlook Add-in, create a package for one real contact -- confirm the package renders correctly at its public link.
3. From `/integrations/list-merge`, select 2-3 real contacts, generate with review-first checked, confirm all packages render correctly, click Send All, confirm both test mailboxes receive a correctly-merged email with a working link, and both appear in the connected account's Sent Items.
4. Repeat once with auto-send (review-first unchecked) -- confirm it sends without the extra confirm click.
5. Force a token refresh: manually set the stored `expires_at` a few minutes in the past via SQL (temporarily, on the test org only) and confirm the next `listOutlookContacts`/`sendViaOutlook` call transparently refreshes and succeeds rather than failing.
6. Confirm every package created through this whole flow has the correct `org_id`/`created_by`, and that disconnecting Outlook (`status = 'disconnected'` -- a disconnect action can be added trivially to `IntegrationsClient.tsx` if not already wired) stops `getValidAccessToken` from being usable.

- [ ] **Step 2: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix: address issues found during T35 end-to-end verification"
```

## Self-Review

**Spec coverage:** shared foundation (Task 1-2), Outlook OAuth (Task 3), contact fetch + single-contact creation (Task 4), list-merge generation (Task 5), sending via the provider (Task 6), the actual in-Outlook launcher (Task 7) -- every element of the approved design has a task. HubSpot/Autotask/ConnectWise/generic are explicitly out of scope (Global Constraints), each gets its own future plan.

**Placeholder scan:** no TBD/TODO; `<your-production-domain>` in the manifest is an explicit fill-in-before-sideloading instruction, not an oversight.

**Type consistency:** `OutlookTokens` (Task 3) is the exact shape `getValidAccessToken`/`refreshTokens` (Task 4) read and write; `createPackageForContact`'s input/output shape (Task 4) matches every call site in Tasks 4, 5, and 7.
