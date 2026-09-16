# Security Audit — Online Shock-and-Awe Portal — 2026-09-16

**Status: the 2 Critical and 2 High findings below were fixed and live-verified the same day** (migration `0024_fix_cross_tenant_write_bypass.sql`; code fixes in `library/actions.ts` and `slug.ts`). Everything else in this report (Medium/Low/Info) is still open, at the user's discretion.

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

## Medium

- Session cookies have no explicit `Secure` flag set (relies on `@supabase/ssr` defaults).
- `tracking_events` INSERT is wide open (`with check (true)`) — by design for the anon-tracking use case, but no rate limiting; could be used to flood a package's Activity log with fake events.
- Every asset on the public page now gets a 1-year signed URL — a deleted document/image stays fetchable via an old link for up to a year (signed URLs can't be revoked early).
- No security headers configured anywhere (`next.config.ts` is an empty config) — no CSP/X-Frame-Options, so the public prospect page is frameable (clickjacking/phishing-shell risk, low-moderate given no sensitive forms on that page).
- `deleteLayout` reports false success when the target doesn't exist (tenant isolation itself is intact here — this is a correctness/UX bug, not a leak).

## Low / Info (10 Low, ~13 Info — full detail in the linked reports)

Highlights: no max-length/email-format validation on several free-text fields; `external_url` on link assets isn't scheme-validated; several dashboard Server Actions return raw Postgres error text to the client; a few defense-in-depth inconsistencies (ordering of ownership checks, one field bypassing a validation helper) that aren't independently exploitable; `.env.example` is missing `GATE_DESK_API_KEY` and lists an unused `VIMEO_ACCESS_TOKEN`.

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

## Bonus finding (from Supabase's own security advisor, run after applying the fixes)

**Leaked Password Protection is disabled** in Supabase Auth (checks new passwords against HaveIBeenPwned.org). Free, one-click toggle in the Supabase dashboard (Authentication → Policies) — not something fixable via a migration. No other new issues were introduced by the fixes above; every other advisor warning is the same pre-existing, by-design item already documented in [02-rls-multitenancy.md](02-rls-multitenancy.md) Finding 4.

## Remaining work (not yet fixed, at your discretion)

1. Batch the five Medium findings (security headers, cookie `Secure` flag, `tracking_events` open insert, non-revocable 1-year signed URLs, `deleteLayout` false-success).
2. Low/Info — none are urgent.
3. Consider rotating `GATE_DESK_API_KEY` and `SECURAFY_HUBSPOT_TOKEN` (see the process note above).
4. Consider rate-limiting the public slug lookup as defense in depth beyond the entropy fix.
5. Enable Leaked Password Protection in Supabase Auth settings.
