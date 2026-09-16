# Security Audit — Authentication, Session Management, Access Control

Scope: Online Shock-and-Awe Portal (multi-tenant Next.js 16 / Supabase SaaS).
Audit date: 2026-09-16. Read-only review — no files modified, no SQL executed.

---

## Finding 1 — Session cookie has no explicit `Secure` attribute

**Severity**: Medium
**Title**: Supabase auth cookies are set without an explicit `Secure` flag
**File:Line**: `src/lib/supabase/server.ts:19-23`, `src/lib/supabase/middleware.ts:20-27`, `src/lib/supabase/client.ts` (all three construct their Supabase SSR client with no custom `cookieOptions`, so the library default applies)

**Description**: All three Supabase client factories (`server.ts`, `client.ts`, `middleware.ts`) let `@supabase/ssr` supply cookie options. Inspecting the installed package (`node_modules/@supabase/ssr/dist/main/utils/constants.js`) shows its `DEFAULT_COOKIE_OPTIONS`:
```
{ path: "/", sameSite: "lax", httpOnly: false, maxAge: 400*24*60*60 }
```
There is no `secure: true` anywhere in the package, and nothing in this codebase overrides it. `sameSite: "lax"` is appropriate (it is the actual CSRF backstop for the one cookie-authenticated Route Handler, `/api/help-chat` — see Finding verified-safe list). But without an explicit `Secure` attribute, the browser will still transmit the session cookie over a plain-HTTP request if one is ever made to the app's origin (e.g., a misconfigured load balancer, a direct-IP request that bypasses an HTTPS redirect at the edge, or a user manually typing `http://`).

**Exploit scenario**: If the hosting layer (Railway) ever serves the app over HTTP even transiently (health checks, a misconfigured custom domain before its HTTPS cert/redirect is live, or a network-level MITM on a coffee-shop Wi-Fi that downgrades the connection before HSTS is cached by the browser), the Supabase access/refresh token cookies would be sent in cleartext and could be captured, giving an attacker a live session for that user (rep or admin) until the token expires.

**Recommendation**: Pass explicit `cookieOptions: { secure: true, sameSite: "lax" }` (or better, `secure: process.env.NODE_ENV === "production"` if local dev needs HTTP) to all three `createServerClient`/`createBrowserClient` calls, and add an HSTS header (`Strict-Transport-Security`) via `next.config.ts` headers or at the Railway edge so browsers stop attempting HTTP after the first successful HTTPS visit.

---

## Finding 2 — Session cookie is not `httpOnly` (increases XSS blast radius)

**Severity**: Low (Info-adjacent — this is an inherent trade-off of `@supabase/ssr`, not a bug introduced by this codebase)
**Title**: Auth cookie is readable by page JavaScript
**File:Line**: Same as Finding 1 — `DEFAULT_COOKIE_OPTIONS.httpOnly = false` in `@supabase/ssr`

**Description**: `@supabase/ssr` deliberately sets `httpOnly: false` because the browser Supabase client (`src/lib/supabase/client.ts`) needs to read the session token from `document.cookie` for client-side calls and cross-tab session sync. This is the standard, documented trade-off of the SSR cookie-auth pattern, not a misconfiguration specific to this app. The practical consequence is that any successful XSS injection anywhere on an authenticated page could read and exfiltrate the full session (access + refresh token), not just make same-origin requests.

**Exploit scenario**: If an XSS vector were ever introduced elsewhere in the app (e.g. an unsanitized `dangerouslySetInnerHTML` fed by user input, or a vulnerable third-party script), an attacker's injected script could read the auth cookie directly and replay it from their own machine, bypassing `sameSite` entirely (which only restricts the browser's own cross-site request behavior, not a script reading `document.cookie` same-origin).

**Recommendation**: No code change recommended here specifically (breaking `httpOnly` would break the client SDK), but treat any future `dangerouslySetInnerHTML`, unsanitized markdown rendering, or third-party script inclusion as high severity given this cookie exposure. I searched the codebase for `dangerouslySetInnerHTML` and found exactly one use (`src/app/layout.tsx`, a static inline theme-init script with no user-controlled interpolation) — not currently exploitable.

---

## Finding 3 — No application-level rate limiting or CAPTCHA on login/signup/password-reset

**Severity**: Low (Supabase Auth applies its own default per-IP/per-project throttling on these endpoints, so this is not an unmitigated brute-force hole — but there is no additional app-layer defense)
**Title**: No custom throttling on authentication endpoints
**File:Line**: `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/forgot-password/page.tsx` (all call `supabase.auth.*` directly from the browser with no wrapping rate limiter)

**Description**: I grepped the codebase and `.env.example` for `captcha`, `turnstile`, `rate-limit`, and `upstash` — no matches. There is no custom rate limiting, no CAPTCHA/Turnstile integration, and no lockout-after-N-attempts logic anywhere in the auth flows. The app relies entirely on Supabase Auth's built-in server-side rate limits (which do exist and are non-trivial — Supabase throttles sign-in, sign-up, and OTP/recovery endpoints per-IP by default), so this should not be characterized as "no protection at all."

**Exploit scenario**: A distributed credential-stuffing attack (spread across many IPs, each staying under Supabase's per-IP threshold) would not be slowed by anything in this app's own code. Realistic risk is moderate given Supabase's baseline defenses, but a determined/distributed attacker has more room here than if the app added its own IP+email-keyed throttling.

**Recommendation**: If this becomes a real threat model (e.g., once the portal has enough tenants to be a credential-stuffing target), add CAPTCHA (Supabase Auth supports hCaptcha/Turnstile natively via `captchaToken`) to login/signup/forgot-password, or a lightweight app-level limiter (e.g., Upstash Ratelimit) keyed by email+IP. Not urgent for current scale.

---

## Finding 4 — `isPublicRoute` uses prefix matching (`startsWith`) instead of exact-path matching

**Severity**: Low
**Title**: Middleware public-route allowlist is prefix-based, not boundary-safe
**File:Line**: `src/lib/supabase/middleware.ts:38-44`

**Description**:
```ts
const isPublicRoute =
  pathname.startsWith("/s/") ||
  pathname.startsWith("/login") ||
  pathname.startsWith("/signup") ||
  pathname.startsWith("/forgot-password") ||
  pathname.startsWith("/reset-password") ||
  pathname.startsWith("/api/packages");
```
I walked every route currently defined under `src/app/` and confirmed none of them accidentally collide with these prefixes today (e.g. there is no `/login-*`, `/signup-*`, or `/api/packages-*` route, and `/api/packages` has exactly one `route.ts`, itself independently bearer-token gated — see verified-safe list). So there is **no live vulnerability** from this pattern right now. However, `startsWith` is a fragile pattern: any future route named e.g. `/signup-analytics` or `/login-history` (dashboard-only) would silently become public the moment it's added, with no test or type system to catch it.

**Exploit scenario**: Not currently exploitable. Hypothetical: a future engineer adds `src/app/(dashboard)/reset-password-log/page.tsx` (admin audit view) — it would be unauthenticated by accident because its pathname starts with `/reset-password`.

**Recommendation**: Tighten each check to require a path boundary, e.g. `pathname === "/login" || pathname.startsWith("/login/")` (repeat per route), or switch to a small explicit `Set` of exact public paths plus the one legitimate prefix (`/s/`) that's supposed to match many slugs.

---

## Finding 5 — Signup "join existing org" trust boundary depends on a Supabase project setting not visible in this repo

**Severity**: Info
**Title**: Tenant-join self-service flow assumes email ownership is verified before `complete_signup()` runs
**File:Line**: `src/app/signup/page.tsx:91-113`, `supabase/migrations/0010_multi_tenant_orgs.sql` (`complete_signup` function)

**Description**: `complete_signup()` is well-designed — it derives `org_id` and `role` entirely server-side from `auth.users.email` for `auth.uid()` (the verified session), never from client input, so a client cannot fabricate which org they join or what role they get (confirmed by reading the function body). The remaining question is *when* that session becomes valid: `signup/page.tsx` calls `supabase.auth.signUp({ email, password })` and only proceeds to `complete_signup()` if `data.session` is present, explicitly bailing out with "check your email to confirm" if not — this is the correct client-side behavior *if* the Supabase project has "Confirm email" enabled. If that project setting were ever disabled, `signUp()` would return a live session immediately for any email string typed in, without proving the caller owns that mailbox, and `complete_signup()` would let them join `securafy.com` (or any org) as a `rep` — a real tenant-boundary bypass. This setting lives in the Supabase Auth dashboard, not in this repo (no `supabase/config.toml` with `[auth]` present), so it could not be verified from the codebase alone.

**Exploit scenario**: If "Confirm email" is off: attacker types `someone@victim-tenant.com` (a domain they don't control) into the signup form, gets an immediate session (no email ownership proof), and calls `complete_signup('join')`, landing inside that tenant's org as a rep — able to see that org's packages/assets per `packages_select_org`/`assets_select_org` RLS.

**Recommendation**: Confirm in the Supabase dashboard (Authentication → Providers → Email) that "Confirm email" is enabled for this project. This is a one-time settings check, not a code change — flagging it here because it's the single external variable this entire tenant-join flow's safety depends on.

---

## Finding 6 — `find_org_by_email_domain` is callable pre-auth and lets anyone probe which domains have a tenant

**Severity**: Info
**Title**: Minor org-existence/name enumeration via anon-callable RPC
**File:Line**: `supabase/migrations/0010_multi_tenant_orgs.sql` (`find_org_by_email_domain`, `grant execute ... to anon, authenticated`), used from `src/app/signup/page.tsx:34-48`

**Description**: This RPC is intentionally public (needed so the signup page can say "Join Acme Corp?" before the user has a session) and, per its own migration comment, is deliberately narrow — it returns only `org_id`/`org_name`, never membership or any other org data. That design goal is correctly implemented. The residual exposure is that anyone (no auth required) can enumerate which email domains have a tenant on the platform and learn that tenant's display name, e.g. confirming "Securafy resells this tool to Client X."

**Exploit scenario**: Competitive intelligence gathering — an outsider scripts calls to this RPC with a list of guessed company domains to build a list of the platform's customers. No access to any customer data results from this.

**Recommendation**: Accept as-is (this is a deliberate, already-scoped-down design decision per the migration's own comment) unless the customer list itself is considered sensitive, in which case add basic per-IP rate limiting to the RPC's call path (harder to do for a direct RPC than a Route Handler — would likely need a thin API route wrapper to add throttling).

---

## Finding 7 — Changing password does not require the current password

**Severity**: Low
**Title**: `ChangePasswordForm` allows password change from any live session with no re-authentication
**File:Line**: `src/app/(dashboard)/account/ChangePasswordForm.tsx:36-38`

**Description**: `ChangePasswordForm` calls `supabase.auth.updateUser({ password: newPassword })` directly, with no prompt for the current password. Any valid session (however it was obtained) can silently take over the account by changing its password, without proving knowledge of the existing credential.

**Exploit scenario**: An attacker who obtains a live session token through any means other than the credential itself (a shared/unlocked device, a stolen session cookie via the XSS scenario in Finding 2, or a session left open on a public computer) can permanently lock the legitimate user out by changing the password, with no additional friction.

**Recommendation**: Standard hardening would re-authenticate before a sensitive change (Supabase supports re-auth via `signInWithPassword` immediately before `updateUser`, or checking session freshness). Low priority given this requires an attacker to already have a live session through some other compromise.

---

## Finding 8 — Admin-issued temporary passwords are not forced to rotate

**Severity**: Info
**Title**: No forced password change after admin-created account or admin-triggered reset
**File:Line**: `src/lib/user-management.ts:29-68` (`createUserWithTempPassword`, `resetUserPassword`)

**Description**: Both functions generate a strong random 22-character temp password and hand it back once for the admin to relay out-of-band (deliberate design, documented in code comments, to avoid the email-link-scanning problem this app already hit once). Nothing forces the recipient to change that password on first login — Supabase has no bespoke Server Actions to require it (I did not find a `must_change_password` flag or first-login gate). If an admin relays the password over an insecure channel and the recipient never rotates it, that password lives on indefinitely.

**Recommendation**: Low priority given the password is high-entropy and admin-relayed rather than emailed. If desired, add a `must_change_password` boolean to `profiles`, set it on admin-issued accounts/resets, and check it in the dashboard layout to force a redirect to `/account` until changed.

---

## Verified NOT vulnerable

The following were specifically checked and confirmed safe:

1. **Session validation uses `getUser()`, not `getSession()`**, everywhere a trust decision is made: `src/lib/profile.ts` (`getCurrentProfile`), `src/lib/supabase/middleware.ts`. `getUser()` revalidates the token against the Supabase Auth server rather than trusting a locally-decoded JWT, per Supabase's own security guidance for server contexts.
2. **Middleware redirect does not leak query params**: `updateSession` builds a fresh `new URL("/login", request.url)` rather than `.clone()`, per an existing code comment explaining a prior fix for exactly this leak.
3. **Every dashboard route requires auth**: walked all routes under `src/app/(dashboard)/` (`/`, `/library`, `/packages`, `/packages/[slug]`, `/packages/new`, `/account`, `/help`, `/templates`, `/templates/layout-designer`, `/team`, `/admin`) against `middleware.ts`'s `isPublicRoute` list — none match any public prefix, so all require a valid session via `updateSession`. `(dashboard)/layout.tsx` additionally re-checks `getCurrentProfile()` and `profile.is_active` server-side as defense-in-depth against direct navigation.
4. **`/api/packages` public-route exemption is safe**: it is the only file at that path, and it independently enforces its own bearer-token check (`isValidBearerToken`, constant-time compare via `timingSafeEqual`) before touching the database — the middleware's exemption does not leave it unauthenticated, it uses a different (correct) auth mechanism for a server-to-server caller.
5. **`/api/help-chat` re-checks auth server-side** (`getCurrentProfile()` + `is_active`) rather than relying solely on middleware having let the request through.
6. **Privilege escalation — `team/actions.ts:setProfileRole`**: correctly relies on RLS + trigger rather than an application-level check (a legitimate pattern per Next.js's own Server Actions security guidance: "render-time gating is not a security boundary"). Verified the underlying policies: `profiles_update_admin` (`using (public.is_org_admin(org_id))`, migration 0008) requires the caller to be an admin *of the target row's own org* — a same-org requirement enforced by the DB, not just intended by convention. `prevent_self_role_escalation` trigger (migrations 0008/0009/0011/0014) independently blocks any role change unless the caller is an org-admin of the target's org, blocks `org_id` mutation unconditionally for non-service-role callers, and blocks self-`is_active` changes. Confirmed the `EXECUTE` lockdown migrations (0002, 0006, 0007, 0009, 0011) correctly revoke `public`/`anon`/`authenticated` execute rights on these trigger/helper functions so they can't be invoked directly as RPCs to bypass the trigger context.
7. **Privilege escalation — `admin/actions.ts`**: every exported action (`adminAddUser`, `adminResetUserPassword`, `adminSetUserActive`, `adminSetProfileRole`, `adminSetPlatformAdmin`) calls `assertPlatformAdmin()` first, which re-derives the caller's profile from a server-verified session (`getCurrentProfile()`) — not from any client-supplied value — before performing any service-role (RLS-bypassing) mutation. `adminSetPlatformAdmin` additionally re-checks the *target*'s `org_id === SECURAFY_ORG_ID` before granting, backed by an un-bypassable DB `CHECK` constraint (`profiles_platform_admin_only_securafy`, migration 0014) even if the application check were ever removed.
8. **IDOR — `team/actions.ts:resetTeamMemberPassword` / `setTeamMemberActive`**: both call `assertSameOrgTarget()`, which does a live, RLS-scoped `SELECT` on the target profile through the *regular* (non-admin) client before calling into the RLS-bypassing service-role mutation — an admin from Org A cannot target a user in Org B, because RLS itself will return no row for a cross-org lookup.
9. **IDOR — `account/actions.ts:updateCalendarUrl`**: takes no id parameter from the client at all; scopes the update to `profile.id` from the server-verified session.
10. **Tenant/role injection at signup — `complete_signup()` RPC**: role (`admin` on create / `rep` on join) and `org_id` are derived entirely server-side from the authenticated user's verified email domain; the client's `p_action`/`p_company_name` inputs cannot select an arbitrary org or role.
11. **Password reset flow**: `forgot-password/page.tsx` shows an identical success message regardless of whether the email exists (no account-enumeration via this endpoint). `reset-password/page.tsx` requires a valid emailed OTP verified server-side via `supabase.auth.verifyOtp({ type: "recovery" })` before `updateUser()` is allowed to run — there is no path that sets a password without that verification succeeding first.
12. **Login enumeration**: `login/page.tsx` surfaces whatever error Supabase Auth returns; Supabase's default `signInWithPassword` error message does not distinguish "no such user" from "wrong password."
13. **CSRF**: no Route Handler in this codebase re-implements a form-POST-style mutation that bypasses Next.js's built-in Server Actions CSRF protection (Origin/Host header comparison, confirmed present and unmodified via `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` for this specific Next.js 16.3.4 build, and no `serverActions.allowedOrigins` override exists in `next.config.ts` that could widen it). The two Route Handlers found (`/api/packages`, bearer-token auth; `/api/help-chat`, cookie session + explicit server-side re-check) are legitimate separate API surfaces, not CSRF-bypassing replacements for a Server Action. Bound Server Action arguments (e.g. `setProfileRole.bind(null, p.id, role)` in `TeamClient.tsx`) rely on Next.js's closure-variable encryption, so a client cannot tamper with the bound `profileId`/`role` to target a different user by editing the request.
14. **Deactivated-user handling**: `(dashboard)/layout.tsx` re-checks `profile.is_active` on every request (not just at login), and the `prevent_self_role_escalation` trigger separately blocks a user from PATCHing their own `is_active` back to `true` via a direct REST call that bypasses the app's UI.

---

**Coverage**: 26 project files read in full (all 20 files named in the task's file list, plus `src/lib/supabase/admin.ts`, `src/lib/org.ts`, `src/app/api/packages/route.ts`, `src/app/api/help-chat/route.ts`, `src/app/layout.tsx` for the XSS/cookie check, and `next.config.ts`), plus 10 SQL migration files (`0001`, `0002`, `0005`–`0011`, `0014`) and the relevant `@supabase/ssr`/Next.js internals (`node_modules/@supabase/ssr/dist/main/utils/constants.js`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`) to verify library-level defaults referenced above.
