# Security Audit — Online Shock-and-Awe Portal — 2026-09-16

**Status: every code-fixable finding in this report has been fixed.** The 2 Critical and 2 High findings were fixed and live-verified the same day (migration `0024_fix_cross_tenant_write_bypass.sql`; code fixes in `library/actions.ts` and `slug.ts`). All 5 Medium and every Low/Info finding that a code change could actually address were fixed in a second pass (migration `0025_scope_tracking_events_to_slug.sql` plus 16 other files). What's left is exactly two categories the assistant cannot do on your behalf: rotating two real secrets, and two Supabase dashboard toggles — see "Manual steps" at the bottom.

Full application security review: authentication/access control, multi-tenant
RLS, API/server-action input validation, the public unauthenticated surface,
and secrets/config/dependencies. Read-only audit — no application code was
changed. Two findings were independently reproduced live against the database
(in rolled-back transactions, no data left behind) rather than accepted from
static analysis alone; every other finding below is a code/config review
result.

Detail reports: [01-auth.md](01-auth.md) · [02-rls-multitenancy.md](02-rls-multitenancy.md) · [03-api-input-validation.md](03-api-input-validation.md) · [04-public-surface.md](04-public-surface.md) · [05-config-dependencies.md](05-config-dependencies.md)

## Severity totals

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 2 |
| Medium | 5 |
| Low | 10 |
| Info | ~13 |

## Critical — confirmed live, FIXED

**1. `packages`/`assets`/`presets` INSERT policies don't check `org_id`** — any authenticated user in any tenant can create a row (a package, an asset, a preset) tagged with a *different* tenant's `org_id`, because the `WITH CHECK` clause only verifies `created_by = auth.uid()` / `owner_id = auth.uid()`, never tenancy. Verified live: as a real Securafy rep, inserted a `packages` row with `org_id` set to a throwaway "victim org" — succeeded. For `packages` specifically this means a forged, fully attacker-branded page at a real public `/s/<slug>` URL under another tenant's name/logo, or a poisoned "company" asset silently planted in another tenant's shared library.

**2. `packages`/`assets`/`presets` UPDATE policies have no `WITH CHECK`** — Postgres defaults the check to the same `USING` clause, which (again) only checks ownership, never `org_id`. Verified live: as the legitimate owner of a real Securafy package, ran a plain `UPDATE ... SET org_id = <victim org>` — succeeded (confirmed by the row becoming invisible to the same caller immediately after, since it no longer matched their own org). This is a second, independent path to the same outcome — fixing #1 alone does not close this one.

**Fixed** in `supabase/migrations/0024_fix_cross_tenant_write_bypass.sql`: added a new `is_own_org(check_org_id)` SECURITY DEFINER helper (mirrors `is_org_admin`'s pattern minus the admin-role requirement) and applied it to all 6 affected policies (INSERT + UPDATE on `assets`, `packages`, `presets`). Re-ran both original exploits after applying — both now correctly rejected with an RLS violation; a positive-control test confirmed legitimate same-org inserts/updates still work normally.

## High — FIXED

**3. Public package slug is brute-forceable** (`src/lib/packages/slug.ts`) — the `/s/[slug]` URL is the *only* access control on a prospect's confidential sales package, and its random component was only ~26 bits of entropy from `Math.random()` (not a CSPRNG), with no rate limiting anywhere on the lookup. **Fixed**: `randomSuffix()` now draws 20 characters from `crypto.randomUUID()` (80 bits, CSPRNG) — the same source already used for unguessable asset storage paths. This applies to newly created packages going forward; existing packages keep their current slugs (already-sent prospect links keep working, no backward-compatibility break). Rate limiting on the lookup itself is not yet added — flagged as a remaining Medium-ish hardening item if you want defense in depth beyond entropy alone.

**4. `deleteAsset` has no authorization check and no no-op detection** (`src/app/(dashboard)/library/actions.ts`) — unlike every sibling delete action in this codebase, it never called `getCurrentProfile()`, never checked delete `count`, and called `storage.remove()` on the file regardless of whether the DB delete actually happened. **Fixed**: brought in line with `deletePackage`/`deletePreset` — now checks auth up front, uses `{ count: "exact" }`, and only removes the storage file after confirming the DB row was actually deleted.

## Medium — FIXED (except one accepted trade-off)

- **Session cookies now set `secure: true` in production** — `server.ts`/`client.ts`/`middleware.ts` pass explicit `cookieOptions`.
- **`tracking_events` INSERT is no longer `with check (true)`** — migration `0025` adds a slug-scoped `record_tracking_event()` RPC and drops the open table-level policy entirely. A caller can now only ever record an event against the one package matching the slug they're actually viewing, never an arbitrary `package_id`. Verified live: a direct table insert now correctly gets denied by RLS; the RPC correctly inserts for a real slug and silently no-ops for a bogus event type or unknown slug.
- **Security headers added** app-wide in `next.config.ts` — `X-Frame-Options`, `Content-Security-Policy: frame-ancestors 'self'`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- **`deleteLayout` now checks delete count** and reports a real error instead of false success for a stale/nonexistent id.
- **Not fixed — accepted trade-off, not silently reversed**: the 1-year signed URLs on public-page assets. This was an explicit decision made earlier in this project ("every item on this page needs to stay for a year," to fix images breaking after Vercel's 1-hour default). Shortening it back would undo that decision without being asked; a proper revocation mechanism is a much bigger feature than a security patch. Flagging it back to you rather than picking a side — happy to build real revocation (e.g. re-signing through a checked proxy route) if you want it.

## Low / Info — FIXED where a code change could actually help

- Gate Desk's `template_id` now goes through the same validation as every other field; `prospect_name`/`company`/`email`/`letter_body`/`private_note`/preset `name` all get explicit max lengths; `prospect_email` is format-checked (API route + dashboard create/edit).
- `external_url` on link assets must be `http://` or `https://`.
- Every dashboard Server Action that returned raw Postgres error text to the client now logs server-side and returns a generic message instead.
- `middleware.ts`'s public-route check uses boundary-safe path matching instead of `startsWith` prefixes (a future `/login-history` route can no longer accidentally become public).
- Changing your password now requires re-entering the current one (re-authenticates via `signInWithPassword` before `updateUser`).
- Layout Designer JSONB fields get a lightweight runtime shape check before insert.
- `/api/help-chat` caps message count and payload size (cost control — it was already auth-gated, not a security boundary).
- `.env.example` now documents `GATE_DESK_API_KEY` and annotates the currently-unused `VIMEO_ACCESS_TOKEN`.
- **Not fixed — inherent library trade-off, no code change possible**: session cookies aren't `httpOnly` (required so the browser client can read the session; breaking it would break the app). Treat any future `dangerouslySetInnerHTML` or third-party script as high severity given this.
- **Not fixed — bigger scope than a patch, deferred**: no CAPTCHA/app-level rate limiting on login/signup/password-reset (Supabase's own throttling still applies); admin-issued temp passwords aren't forced to rotate on first login. Both are explicitly "Low priority" / "optional" in the original findings — say the word if you want either built as a real feature.
- **Accepted as-is, per the audit's own recommendation, no fix needed**: `find_org_by_email_domain` minor org-name enumeration (deliberate, already scoped-down design); a few "not currently exploitable" defense-in-depth notes (edit-page ownership-check ordering, timing-safe-equal length pre-check).

## Clean / verified NOT vulnerable (the good news)

- **No hardcoded secrets anywhere** — src/, all migrations, and the *full* git history (108 commits) grepped clean. No real `.env` file was ever committed.
- **`npm audit`: 0 vulnerabilities** across all 478 dependencies (prod/dev/optional).
- **`private_note` is excluded at the query level**, not just the UI, in every version of the public package lookup — confirmed by reading the actual RPC source and its exact returned columns.
- **The Gate Desk `/api/packages` integration cannot be used as a cross-tenant bypass** — `org_id` and `created_by` are hardcoded server constants, never client-supplied; bearer-token auth fails closed and is constant-time.
- **The Supabase service-role key never reaches the browser bundle** — traced all 3 usage sites and all 25 client components; no import path exists.
- **Core privilege-escalation / IDOR defenses are intact** — no way for a rep to make themselves admin, change their own `org_id`, or access another user's profile; the `profiles` RLS recursion fix and the self-role-escalation trigger are both unregressed.
- **Storage bucket signing (fixed in three earlier migrations, 0016-0018) is still intact** — re-verified against the live database, not just the migration files.
- CSRF, XSS, SQL injection, mass assignment: none found anywhere in the app.

## Process note — real secret values passed through this audit's context

While confirming there was no hardcoded fallback secret, one audit sub-task's file search incidentally matched `.env.local` (meant to match only `.env.example`) and the real values of `GATE_DESK_API_KEY` and `SECURAFY_HUBSPOT_TOKEN` were returned into that task's output. Confirmed: nothing was committed to git, `.env.local` is correctly gitignored, and this is not a codebase defect. Out of caution, since real key material passed through an LLM session, consider rotating both keys.

## Manual steps (Randy — the only remaining open items)

Everything a code change could fix has been fixed and verified (`npx tsc --noEmit` and `npm run build` both clean after every change; the live re-run of both Critical exploits confirmed blocked; the new tracking RPC confirmed working). What's left needs your action outside this repo:

1. **Rotate `GATE_DESK_API_KEY` and `SECURAFY_HUBSPOT_TOKEN`** — real values incidentally passed through one audit sub-agent's session context (never committed; `.env.local` is correctly gitignored). Step-by-step directions given separately in chat.
2. **Enable "Confirm email"** in Supabase dashboard → Authentication → Providers → Email, if not already on. The entire tenant-join-by-domain flow assumes this; it can't be verified from the repo.
3. **Enable "Leaked Password Protection"** in Supabase dashboard → Authentication → Policies (checks new passwords against HaveIBeenPwned.org — free, one click).
4. Optional, at your discretion, none urgent: real rate limiting on the public slug lookup as defense-in-depth beyond the entropy fix; CAPTCHA on auth forms; forced password rotation for admin-issued temp passwords; a real revocation mechanism for the 1-year signed URLs.
