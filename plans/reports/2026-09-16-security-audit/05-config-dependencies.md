# Security Audit — Secrets Management, Dependencies, Headers, Config

Scope: secrets management, dependency vulnerabilities, security headers, hardcoded config.
Project: `C:\Users\RandyGHall\DEV\Online Shoc-and-Awe`
Date: 2026-09-16 (read-only audit; no files modified, no installs run, no real .env read)

---

## Findings

### Finding 1

- **Severity**: Medium
- **Title**: No security headers configured (missing CSP / X-Frame-Options / frame-ancestors)
- **File:Line**: `next.config.ts:1-8`
- **Description**: `next.config.ts` exports an empty `NextConfig` object — no `headers()` function, no Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security, or Permissions-Policy is set anywhere in the app. Next.js applies no security headers by default, so every response (including the fully public `/s/[slug]` prospect-facing page, confirmed unauthenticated in `src/lib/supabase/middleware.ts:38-44`) is frameable by any third-party site.
- **Exploit scenario**: A malicious actor who obtains or guesses a live `/s/[slug]` link (sent by a sales rep to a prospect) could embed it in an invisible/disguised iframe on an attacker-controlled page and run a clickjacking attack — e.g., overlaying fake UI to trick the prospect into clicking something they didn't intend, or using the branded, trust-conveying Shock-and-Awe page as a phishing shell embedded alongside attacker content. Because this page carries Securafy/tenant branding and is designed to look credible to a prospect who was just told to expect it, it's a plausible social-engineering vector even though the page itself has no sensitive form fields.
- **Recommendation**: Add a `headers()` function in `next.config.ts` setting at minimum `X-Frame-Options: SAMEORIGIN` (or `DENY` for authenticated dashboard routes) and `Content-Security-Policy: frame-ancestors 'self'` for all routes, plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` app-wide. This is a realistic-but-not-urgent fix for a B2B sales tool (no payment/PII collection on the public page today) — Medium rather than High/Critical severity, but worth closing since the public page is the app's core external-facing surface and costs nothing to fix.

### Finding 2

- **Severity**: Low / Info
- **Title**: `GATE_DESK_API_KEY` used in code but undocumented in `.env.example`
- **File:Line**: `src/app/api/packages/route.ts:30` (usage); `.env.example` (absent)
- **Description**: `process.env.GATE_DESK_API_KEY` gates server-to-server package creation via a timing-safe bearer-token comparison (`isValidBearerToken`, lines 29-38), but no `GATE_DESK_API_KEY=` line exists in `.env.example`. Confirmed by grepping `.env.example` and diffing against every `process.env.X` reference in `src/`.
- **Exploit scenario**: N/A — documentation gap only. Not itself exploitable; the risk is a future developer not realizing this var must be set (and set to a strong random value) in production, which could leave `isValidBearerToken` always returning `false` (safe/fails closed) or, if someone works around it carelessly, weakens the check.
- **Recommendation**: Add `GATE_DESK_API_KEY=` to `.env.example` with a comment noting it authenticates Actiforge's Gate Desk server-to-server package-creation calls (see `spec/plan.md` T33).

### Finding 3

- **Severity**: Info
- **Title**: `VIMEO_ACCESS_TOKEN` documented in `.env.example` but unused in code (dead documentation)
- **File:Line**: `.env.example:20`; no corresponding `process.env.VIMEO_ACCESS_TOKEN` reference anywhere in `src/`
- **Description**: `.env.example` documents `VIMEO_ACCESS_TOKEN` for "video/audio hosting," but the only Vimeo-related code (`src/lib/vimeo.ts`) is a pure string-transform helper (`toVimeoEmbedUrl`) that converts a pasted watch-page URL into an embed URL — it never calls the Vimeo API and never reads any token. Reps currently paste public/unlisted Vimeo URLs directly (matches PRD: "Video/audio are hosted on Vimeo (unlisted), not self-hosted").
- **Exploit scenario**: N/A — not a vulnerability, just stale documentation that could mislead someone into thinking a Vimeo API integration exists or needs configuring.
- **Recommendation**: Either remove `VIMEO_ACCESS_TOKEN` from `.env.example` until an actual Vimeo API integration is built, or add a comment noting it's reserved for a future API-based integration not yet implemented.

### Finding 4 (informational, confirmed non-issue)

- **Severity**: Info
- **Title**: Hardcoded UUID constants (`SECURAFY_ORG_ID`, `GATE_DESK_SERVICE_PROFILE_ID`) are identifiers, not secrets
- **File:Line**: `src/lib/hubspot.ts:12` (`SECURAFY_ORG_ID = "00000000-0000-0000-0000-000000000001"`); `src/app/api/packages/route.ts:13` (`GATE_DESK_SERVICE_PROFILE_ID = "f97e0b1c-5b3d-4ee5-94a4-51314ceadc21"`)
- **Description**: Verified both constants are non-secret identifiers, not credentials:
  - `SECURAFY_ORG_ID` is used only to *gate* logic (e.g., "only sync to HubSpot if this org_id matches," "only allow platform-admin actions on this org's profiles" in `admin/actions.ts:95`). Knowing this UUID grants nothing by itself — every code path that uses it (`admin/actions.ts`, `api/packages/route.ts`) is already behind either an authenticated Supabase session with `is_platform_admin` checks, or the separate `GATE_DESK_API_KEY` bearer-token check. RLS policies (per project architecture) additionally scope data access by `org_id` derived from the authenticated user's own profile, not from a client-supplied value.
  - `GATE_DESK_SERVICE_PROFILE_ID` is a foreign-key placeholder (a real `profiles`/`auth.users` row with `encrypted_password = NULL`, per the code comment) used only as the `created_by` value for API-created packages — it cannot be used to authenticate or log in as that profile.
- **Exploit scenario**: None — confirmed these values alone do not grant access; a valid bearer token or authenticated admin session is always separately required.
- **Recommendation**: None required. No change needed.

---

## npm audit summary

Ran `npm audit --json` from the project root (478 total dependencies: 52 prod, 377 dev, 100 optional).

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Moderate | 0 |
| Low | 0 |
| Info | 0 |
| **Total** | **0** |

No vulnerabilities of any severity reported. Full JSON:
```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 },
    "dependencies": { "prod": 52, "dev": 377, "optional": 100, "peer": 0, "peerOptional": 0, "total": 478 }
  }
}
```

**pdfjs-dist**: `package.json` specifies `"pdfjs-dist": "^6.3.289"`; the installed version resolves to exactly `6.3.289` (confirmed via `node -e "require('./node_modules/pdfjs-dist/package.json').version"`). PDF-rendering libraries have a real CVE history (pdf.js has had several past worker/font-parsing vulnerabilities), so this is worth periodic re-auditing, but the currently installed version has no known vulnerabilities per `npm audit`, and the codebase already applies a defense-in-depth fix in `src/proxy.ts` (excluding `.mjs` so the real PDF.js worker script loads instead of silently falling back to slower main-thread parsing) — that comment is about a routing bug, not a security control, but is worth noting as evidence the team is already paying attention to this dependency's operational behavior.

---

## Verified NOT vulnerable / clean

- **No real `.env`/`.env.local`/`.env.production` ever committed**: `git log --all --oneline -- .env .env.local .env.production` returns zero commits across all branches/history.
- **`.env.example` never contained real values**: read the full history of `.env.example` via `git log --all -p -- .env.example` (4 commits total, from initial scaffold to current). Every version has only empty `KEY=` placeholders — never a real secret value at any point in history.
- **No secret ever committed-then-removed**: piped the full `git log --all --source --remotes -p` (108 commits, 33,556 lines of diff) through a case-insensitive grep for `sk_live`, `sk_test`, `AIza`, `AKIA`, `ghp_`, `gho_`, `xoxb-`, `xoxp-`, `ya29.`, and PEM/OpenSSH private-key headers. Zero matches.
- **No hardcoded secrets in `src/` or `supabase/migrations/`**: grepped both trees for known secret-format prefixes (`sk_live_`, `AIza`, `AKIA`, `ghp_`, `xoxb-`, `xoxp-`, `ya29.`) and for the pattern of a `key`/`secret`/`token`/`password`/`auth` variable assigned a long base64/hex literal. Zero matches in either location.
- **Supabase service-role key never reaches client code**: grepped every usage of `SUPABASE_SERVICE_ROLE_KEY` and `createAdminClient` across `src/`. All three call sites are confirmed server-only: `src/app/api/packages/route.ts` (a Route Handler, server-only by definition), `src/app/(dashboard)/admin/actions.ts` and `src/app/(dashboard)/team/actions.ts` (both start with `"use server"`). `src/lib/supabase/admin.ts` itself carries an explicit code comment warning never to import it from a Client Component. Separately grepped all 25 `"use client"` files in the tree — none import `admin.ts` or `user-management.ts`. No path exists for the service-role key to enter the browser bundle.
- **`package.json` scripts clean**: only `dev`, `build`, `start`, `lint` — no `preinstall`/`postinstall`, no remote-code-execution scripts. Checked the only other `package.json` in the repo (`hubspot-extension/src/app/cards/package.json`, a HubSpot UI-extension scaffold) — dependencies only, no scripts at all.
- **`.env.example` vs. actual `process.env.*` usage cross-checked**: every var referenced in `src/` (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SECURAFY_HUBSPOT_TOKEN`) is documented in `.env.example` except `GATE_DESK_API_KEY` (Finding 2, Low/Info). `AI_GATEWAY_API_KEY` is documented and not explicitly read via `process.env` in `src/`, but is used implicitly — `src/app/api/help-chat/route.ts` calls the Vercel AI SDK's `streamText` with model string `"anthropic/claude-sonnet-5"` (Vercel AI Gateway routing syntax), which the `ai` package resolves using `AI_GATEWAY_API_KEY` from the environment automatically; this is legitimate, not dead documentation.

## Unresolved / for Randy's judgment

- Finding 1 (missing security headers) is the only substantive action item — recommend fixing before this app fronts more than a handful of prospect links, since `frame-ancestors`/X-Frame-Options costs nothing and closes a real (if low-severity for this app's data sensitivity) gap.
- Findings 2 and 3 are trivial `.env.example` documentation cleanups — low priority, safe to batch with other doc work.
