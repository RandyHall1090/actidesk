# spec/plan.md — Online Shock-and-Awe Portal

> Implementation plan. This is the build map, not the product spec (that's PRD.md).

## 1. Overview
A **multi-tenant** Next.js + Supabase app with two surfaces: an authenticated rep/admin dashboard (asset library, package creation, tracking, team management) scoped to the signed-in user's organization, and a public renderer that serves the personalized desk-flat-lay page — branded with the sending org's logo — at a unique URL per prospect. Modeled on TMT's Shockbox tool, but Securafy owns the platform and is its first tenant, not its only one.

## 2. Architecture
- **Frontend/Backend**: Next.js (App Router) — one app, route groups for `(dashboard)` [authenticated] and `s/[slug]` [public]
- **Auth & DB**: Supabase (Auth + Postgres + Storage) — email+password (not magic links; see Tech decisions)
- **Multi-tenancy**: a real `orgs` table; every tenant-scoped table (`profiles`, `assets`, `packages`) carries an `org_id` FK; RLS policies gate every read/write by the caller's own `org_id`. Signup matches a new user to a tenant by email domain (see below) — there is no shared login across tenants and no cross-tenant visibility, verified live (see Testing).
- **Video/audio hosting**: Vimeo (unlisted) — app stores the Vimeo video/audio ID and embeds via player
- **Document/image storage**: Supabase Storage (brochures, business card images, magazine cover, company logos)
- **CRM sync**: HubSpot API — Securafy-specific (its own portal); upsert contact + log a timeline event on package creation. Not available to other tenants in v1 (see PRD non-goals).
- Data flow: rep action in dashboard → writes `packages` + `package_assets` rows (scoped to their `org_id`) → generates slug → public route reads that data server-side via `SECURITY DEFINER` lookup functions (never a direct table read — see T5/T9) → prospect interactions write `tracking_events` rows → dashboard reads them back for the "My Sites" view

## 3. Tech decisions
- **Next.js + Supabase** — matches workspace default stack, fastest path to auth + Postgres + storage without standing up separate services
- **Email + password, not magic links** — Securafy's own email security (Safe-Links-style scanning) was consuming the one-time login link before a real click ever happened, confirmed in the Supabase auth logs (repeated `HEAD` requests from Microsoft mail-scanner IPs). Password auth sidesteps the whole class of problem. See T1b.
- **Multi-tenant via email-domain matching, not invite codes** — simplest self-service mechanism: a new domain creates an org (creator becomes admin), a matching domain joins it (as rep). One domain per org for v1; a company with multiple domains is a known limitation, not solved until it's a real request.
- **One fixed template for v1** — avoids building a template/layout engine before proving the core workflow; hardcode slot positions for the single desk-scene layout
- **Vimeo for video/audio** — avoids self-hosting large media, re-encoding, and bandwidth costs; Vimeo tooling is already available
- **Shared platform domain, path-based URLs** (`/s/[slug]`) — no per-tenant subdomain for v1 (this superseded an earlier "subdomain of securafy.com" decision made before multi-tenancy was in scope — a subdomain of Securafy's own domain makes no sense once other companies are tenants). Package links already resolve by slug alone, independent of tenant, so this generalizes cleanly; per-tenant custom domains (matching TMT's own model) are a future feature, not v1.
- **Rep sends the link themselves, app doesn't email prospects** — avoids transactional email deliverability/domain setup for v1
- **HubSpot sync on create, Securafy-only** — keeps the CRM as source of truth for Securafy's own prospect activity; a general per-tenant CRM integration is future work, not v1
- **Company logo is publicly readable** — it's branding, not secret; any tenant's uploaded logo is servable to anon so it can render on that tenant's public package pages

## 4. Milestones
- [x] M1: Auth + asset library (upload/list video/audio/image/document, personal vs. company scope)
- [ ] M2: Desk-scene template art (background image + defined slot coordinates) — design sub-task
- [x] M3: Create-package form + public renderer working end-to-end (functional layout; photoreal art is M2)
- [x] M4: Tracking events + "My Sites" list
- [x] M5: HubSpot sync (Securafy only)
- [x] M6: Multi-rep permissions (admin vs rep, Team page, RLS-enforced)
- [x] M7: Multi-tenant foundation — orgs table, self-service create-or-join signup, org-branded public pages, verified tenant data isolation

## 5. Tasks
| ID | Task | Depends on | Done when | Status |
|----|------|-----------|-----------|--------|
| T1 | Set up Next.js + Supabase project, auth, base schema | — | Rep can log in; empty dashboard loads | ✅ Done |
| T1b | Switch auth from magic links to email+password | T1 | Sign in/up work without any email round-trip for login | ✅ Done — verified live; see Tech decisions for why |
| T2 | Asset library CRUD (video/audio/image/document, personal+company scope) | T1 | Rep can upload/list/delete assets in each category | ✅ Done — video/audio as Vimeo links, everything else to Supabase Storage |
| T3 | Desk-scene template artwork + slot coordinate mapping | — | Background image exists with documented pixel positions for each slot | Not started — public renderer currently uses a clean functional layout, not the photoreal desk scene |
| T4 | Create-package form (all slots) + slug generation | T2 | Submitting the form creates a `packages` row and a working URL | ✅ Done |
| T5 | Public renderer at `/s/[slug]` | T3, T4 | Visiting the URL shows the personalized desk scene with real content playable | ✅ Functional layout done and verified live (real Vimeo embed, letter, tracking, org branding); desk-scene visual (T3) still pending |
| T6 | Tracking events (page view + per-slot open/play) | T5 | Events appear in `tracking_events`; visible in a "My Sites" list | ✅ Done — verified real events landing in the live database from a real browser session |
| T7 | HubSpot sync on package creation | T4 | Creating a package upserts a HubSpot contact + logs a timeline event | ✅ Done — verified live against Securafy's real portal (contact created, note associated, both correct, then cleaned up) |
| T8 | Multi-rep permissions (admin vs rep, company library edit rights) | T2 | Reps see company assets read-only; admins can add/edit them | ✅ Done — RLS-enforced (including a recursion bug found and fixed), Team page for role management, sign-out + self-service password change |
| T9 | Multi-tenant foundation: `orgs` table, self-service create-or-join signup, org branding | T1b | A brand-new email domain creates its own isolated org; a matching domain joins it; each org's data and packages are branded/isolated from every other org's | ✅ Done — verified live via SQL role-simulation (create → join → duplicate-blocked → isolation confirmed) and in a real browser (org name shown in dashboard header and public renderer) |

**Live infrastructure**: Supabase project `shock-and-awe` (ref `fywmrqbxjlocjsdopjep`, `us-east-1`, in the Securafy org) — schema + RLS policies applied. Real URL/anon key are in the gitignored `.env.local`, not in this repo. Storage bucket `assets` (private) holds uploaded images/documents/business cards/logos (except company logos, which are publicly readable — see Tech decisions); video/audio stay Vimeo links. Securafy's own tenant row (`orgs.id = 00000000-0000-0000-0000-000000000001`) backfilled from the pre-multi-tenant schema, so no data migration was needed for it.

**Deployed**: Vercel project `securafy/securafy-shock-and-awe`, live at https://securafy-shock-and-awe.vercel.app (production — Vercel auto-assigns a brand-new project's first deploy to production). Deployed from local files via the Vercel CLI (`vercel deploy` / `vercel deploy --prod`) — this repo has no git remote yet, so there's no git-based auto-deploy on push. Redeploy manually after pulling changes until that's set up.

**RLS recursion bug (found and fixed)**: `profiles`' own SELECT policy queried `profiles` again to check admin status, which Postgres re-applies RLS to — recursing infinitely the moment any real query touched it (a rep's own dashboard included). Static analysis (the Supabase security advisor) never caught this; it only surfaced by actually running queries as each role against the live database. Fixed with a `SECURITY DEFINER` `is_org_admin()` helper (migrations 0005–0007) that breaks the cycle.

**PUBLIC-grant gotcha (recurred twice)**: Postgres grants `EXECUTE` to the `PUBLIC` pseudo-role by default when a function is created, AND a function can separately end up with a *direct* grant to a specific role (`anon`) that is NOT the same thing and is unaffected by `revoke ... from public`. `prevent_self_role_escalation()` had exactly this — a direct `anon` grant that survived two `revoke ... from public` attempts, only found by reading the raw ACL (`pg_proc.proacl`) instead of trusting the advisor or assuming a revoke "worked" (migrations 0009/0011). **Lesson: always revoke `from public, anon, authenticated` explicitly** for any function that should never be callable directly (0002 got this right from the start); and verify with `has_function_privilege(...)` or the raw ACL, not just by re-running the advisor once.

**Real auth blocker found (needs Randy) — still open, re-verified live 2026-09-08**: Supabase's "Confirm email" setting is ON for this project — every `signUp()` call tries to send a confirmation email, which both eats the very low default-email-sender quota and reintroduces the corporate-email-scanning problem login already moved away from. Re-tested live today via a real browser signup attempt: `signUp()` failed outright with "email rate limit exceeded" (no `auth.users` row was even created), confirming the setting is still ON. Needs to be turned OFF in the dashboard (Authentication → Sign In / Providers → Email) for self-service signup to actually complete without an email dependency. No API access to check or change this setting — no Supabase MCP tool exposes GoTrue's mailer config either, only SQL/project metadata.

**Signup page bug found and fixed**: `src/app/signup/page.tsx`'s password-submit handler called `supabase.auth.signUp()` and then unconditionally proceeded to call `complete_signup()`, without checking whether `signUp()` actually returned a session. When email confirmation is required (see above), no session is established, so `complete_signup()` would silently run using whatever session already happened to exist in that browser (e.g., a stale one from a different, earlier test account) — joining/creating an org as the wrong user instead of the one just signed up. Fixed by checking `data.session` after `signUp()` and stopping with a clear error if it's absent, instead of proceeding blind. Verified live: a fresh signup attempt against the still-unconfirmed-email project now correctly surfaces the real "email rate limit exceeded" error and does not call `complete_signup()`.

**Dev/test account created (authorized by Randy)**: `claude-dev@securafy.com`, joined to the Securafy org as `rep`. Because self-service signup is blocked by the still-open "Confirm email" issue above, this account was created directly via SQL against `auth.users`/`auth.identities` (same GoTrue-seeding steps as the gotchas below) with `email_confirmed_at` pre-set, then joined via `complete_signup('join')` run as that user through SQL role-simulation. Verified with a real browser login — reaches the dashboard, shows "Securafy" as the org, hides the admin-only "Team" link (correct for a rep). This is a workaround for internal dev access only; it does not fix self-service signup for real customers, which still needs the dashboard setting changed.

**GoTrue seed-user gotchas (recurring across sessions)**: creating a test `auth.users` row directly via SQL (needed since there's no service-role key available to use the Admin API) requires, beyond the obvious columns: a matching `auth.identities` row, several nullable token columns explicitly set to `''` (not `NULL` — GoTrue's Go driver can't scan a NULL into those), and `instance_id = '00000000-0000-0000-0000-000000000000'` (defaults to `NULL` if omitted, which makes GoTrue's user lookup silently fail with "Invalid login credentials" rather than a clearer error). All confirmed by hitting each one for real, not assumed.

**HubSpot env var naming (deliberately not `HUBSPOT_PRIVATE_APP_TOKEN`)**: the token is read from `SECURAFY_HUBSPOT_TOKEN`, not the more obvious generic name. Found live: Randy's machine already has a Windows User-level environment variable named `HUBSPOT_PRIVATE_APP_TOKEN` (a different, unrelated token, kept intentionally for another project) — Next.js's env loader never overrides a key already present in `process.env`, so the real token in `.env.local` was being silently ignored no matter what was written there, with no error until the API call itself failed. Renamed to a Securafy-specific var everywhere (`.env.example`, `.env.local`, `src/lib/hubspot.ts`, Vercel prod+preview) to sidestep the collision rather than touch Randy's global machine state. **Lesson: prefer app-specific env var names over generic ones for anything that isn't a widely-standardized convention** — a generic name is one collision away from being silently shadowed with no error.

**Confirm email — resolved**: Randy turned off Supabase's "Confirm email" setting (2026-09-08), closing out the self-service signup blocker described above. Not yet re-verified live against a fresh signup — do that before relying on it.

**New: Supabase transactional email bounce warning → migrating to Resend SMTP**: Supabase flagged this project's auth project for a high bounce rate on its default email sender and warned of a possible sending restriction. Randy has a paid Resend account to use as custom SMTP instead. No Supabase MCP tool exposes Auth SMTP config (only Postgres-level tools are available: `execute_sql`, `apply_migration`, etc.) — this has to be set by Randy directly in the dashboard: Project Settings → Authentication → Emails → SMTP Settings → enable custom SMTP, with `smtp.resend.com`, port `465` (or `587`), username `resend`, password = a Resend API key, and a sender address on a domain verified in Resend. Not yet done as of this writing.

## 6. Testing
- Unit: slug generation/uniqueness, asset-scope permission checks, HubSpot payload construction
- Integration: create-package → public page render → tracking event write, end to end
- Integration: signup create-or-join flow, tenant data isolation (verified via SQL role-simulation: two orgs, cross-org visibility confirmed at zero)
- Manual check: create a real package as a test prospect, open the link on desktop and mobile, confirm every slot renders and tracking fires

## 7. Open questions
- Expected volume (packages/month) — mostly moot now that the Supabase project exists ($10/mo flat), but still informs storage/Vimeo plan choices later
- Whether to gate who can create a *brand-new* tenant (e.g. block free email providers) — none exists today, revisit if it becomes a real problem
- Per-tenant custom domain support (matching TMT's model more closely) — explicitly deferred past v1
