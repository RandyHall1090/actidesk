# PRD — Online Shock-and-Awe Portal

> Product Requirements Document.

## 1. Summary
A **multi-tenant** portal — Securafy is both the platform operator and its first customer — that lets any company's sales reps build and send a fully personalized, trackable "Online Shock-and-Awe" package to a prospect ahead of a meeting — a branded, photoreal desk-flat-lay page containing a video, audio message, business card, magazine feature, personal letter, and brochures — then see when and how the prospect engages with it. Modeled on TMT's Shockbox tool, but positioned the same way TMT is to Securafy today: Securafy becomes the provider, reselling the tool to its own clients, each with fully separated data and their own branding.

## 2. Problem
Reps have no fast way to send a prospect a rich, credibility-building package before a first meeting. TMT's Shockbox tool (dashboard.technologymarketingtoolkit.com/shockbox) proves the format works — a personalized "pre-meeting materials" site, sold multi-tenant to TMT's member companies (Securafy included). Securafy wants to build and own the same kind of tool, use it internally, and resell it to its own clients.

## 3. Users
- **Tenants**: companies using the platform — each is a separate organization with its own reps, asset library, and branding. Securafy is the first tenant; the platform is designed to onboard others without code changes.
- **Reps** (within a tenant): the people creating and sending packages. Their goal: send a prospect a memorable, trust-building package minutes after booking a meeting, with zero design effort.
- **Admins** (within a tenant): manage the company asset library and teammates' roles.
- Current pain: no in-house equivalent exists; TMT's version isn't Securafy's to control, extend, resell, or integrate with its own CRM.

## 4. Goals
- Any company (tenant) can sign up, fully separated from every other tenant's data
- A rep can generate a personalized package for a named prospect in a few minutes
- The generated page looks and feels like the TMT example (desk flat-lay, not a plain list of links), branded with the sending tenant's own logo/name
- Reps can see whether and how a prospect engaged after sending
- (Securafy specifically) sending a package logs/updates the prospect in Securafy's HubSpot

## 5. Non-goals (v1)
- The app emailing prospects directly (reps send the link themselves)
- Per-tenant custom domains/subdomains (shared platform domain, path-based URLs for v1 — see spec/plan.md)
- Self-hosting raw video/audio files (linking out to Vimeo instead)
- CRM integration for tenants other than Securafy — HubSpot sync is Securafy-specific (its own portal, hardcoded); a general per-tenant CRM integration is a future feature, not v1
- Full visual white-labeling (colors, fonts) — v1 white-labeling is just the tenant's logo + name; anything deeper is a later feature
- Multiple email domains per tenant, or an invite-code-based join flow — v1 matches teammates to a tenant purely by email domain

## 6. Features
| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Multi-tenant signup | Self-service: a new email domain creates a new organization (its creator becomes admin); a matching domain joins the existing one (as rep) |
| P0 | Asset library | Company-wide + personal libraries for video, audio, images, documents, business cards, logo — scoped per tenant |
| P0 | Create package | Form to enter prospect info and pick/upload an asset for every slot (video, a second video, audio, business card, magazine, letter text, brochures) |
| P0 | Desk-flat-lay renderer | Public page at a unique URL rendering the personalized template with all chosen assets, playable/openable, branded with the sending tenant's logo/name |
| P0 | Tracking | Log page views and per-asset opens/plays; surface in a "My Sites" list per rep |
| P0 | Team management | Admins see everyone in their org and can promote/demote rep ↔ admin, add a user directly (system-generated temp password, no email), reset a locked-out user's password, and deactivate/reactivate a user without deleting their historical packages/assets |
| P0 | Lost password | Self-service reset via an emailed numeric code (not a clickable link, to avoid the same corporate email-link-scanning problem login already moved away from) |
| P0 | Platform admin (Securafy only) | A `/admin` page for Securafy staff with full cross-tenant access — the same add/reset-password/deactivate/role tools as Team management, applied across every tenant, not just one org |
| P1 | HubSpot sync (Securafy only) | Upsert the prospect as a HubSpot contact and log a timeline event when a package is created |
| P1 | Templates | Any rep picks a desk-scene layout per package (the built-in ones, or any their own org has saved by an admin) and manages reusable content presets — named bundles of asset picks + letter text applied when creating a package. A rep can keep a preset personal or share it with their team; any preset can be edited in place (by its owner or an admin) or cloned into your own independent copy as a starting point for a new one |
| P1 | Layout designer (self-service) | Any org's own admin visually drags/resizes/rotates desk-scene slot positions on a background (an existing one, or their own uploaded image) and saves it directly — no developer or deploy step. Saved layouts are private to that org; a separate dev-assisted path still exists for shipping a new layout every tenant gets |
| P2 | Per-tenant CRM integration | Let other tenants connect their own CRM, not just Securafy's HubSpot |

## 7. User flow

**Signup (new tenant or new teammate)**:
1. Enter a work email → the app checks if an organization already exists for that email's domain
2. No match → "Create your company" (name it, set a password) → becomes that org's first admin
3. Match found → "Join {Company}" (just set a password) → joins as a rep

**Sending a package**:
1. Rep logs in, clicks "Create Package"
2. Enters prospect name/company/email
3. Picks or uploads a video, audio message, business card, magazine cover, writes/edits the letter body, and picks brochures — from their library, the company library, or fresh upload
4. Clicks "Create" → gets a unique URL
5. Rep copies the link and sends it to the prospect themselves (their own email/Outlook)
6. (Securafy only) package is upserted into HubSpot as a contact + timeline event
7. Prospect opens the link, sees the personalized desk-scene page (branded with the rep's company logo/name), plays/opens content
8. Rep checks "My Sites" to see it was opened and what was engaged with

## 8. Success metrics
- Time to create and send a package: under 5 minutes
- % of sent packages opened by the prospect
- Adoption: number of active reps creating packages per week

## 9. Risks & open questions
- Risk (resolved): the desk-scene template art needed to scale correctly across screen sizes → done via container-query-relative (`cqw`) sizing instead of fixed px/rem, verified live at both desktop and mobile widths; see spec/plan.md T3 notes
- Risk: fully-custom-per-send personalization means a longer create-package form → mitigate with sensible library defaults so reps aren't forced to upload something new every time
- **Confirm-email blocker — resolved (2026-09-09)**: Supabase's "Confirm email" setting was ON, reintroducing the corporate-email-scanning problem login already moved away from. Now off and verified live — see spec/plan.md for the full story (it was initially changed on the wrong Supabase project).
- **Public-page documents unreadable to real anonymous visitors — resolved (2026-09-13)**: brochures/documents/company logos on `/s/[slug]` were silently unreadable to a genuine logged-out prospect since the underlying tables' RLS was written — `assets`/`package_assets` had no anon-readable SELECT policy at all, so the Storage policies gating signed-URL generation always returned zero rows for anon regardless of the real data. Every prior "verified live" test of this rendering had actually run from an already-authenticated browser session, which masked the bug entirely. Fixed at the database level with two narrow `SECURITY DEFINER` lookup functions (matching this app's existing public-lookup pattern) instead of a blanket table grant. See spec/plan.md T18 for the full diagnosis.
- **New risk**: Supabase flagged this project for a high bounce rate on its default transactional email sender and warned it may restrict sending. Fix is to switch to custom SMTP via Randy's paid Resend account — needs to be done in the Supabase dashboard (no API access to Auth SMTP config); not yet done.
- Decided: public URLs use a shared platform domain with path-based links (`/s/[slug]`) — no per-tenant subdomain for v1 (superseded the earlier "subdomain of securafy.com" decision, which assumed single-tenant)
- Decided: a company (tenant) is matched to signups purely by email domain — one domain per org; multiple domains per company is a known v1 limitation
- Decided: no asset import/migration needed — each tenant seeds their own Company Library by uploading directly through the app
- Open question: video/audio hosting — assuming Vimeo (unlisted) links rather than self-hosted files; confirm before building the upload flow
- Open question: should there be any gate on who can create a *new* tenant (e.g. blocking free email providers like gmail.com from "creating a company")? None exists today — YAGNI until it's an actual problem.

## 10. Milestones
- [x] M1: Asset library (upload/list video, audio, images, documents) working for one user
- [x] M2: Create-package form + functional-layout renderer working end-to-end (photoreal desk-scene art still pending)
- [x] M3: Tracking (page view + asset-open events) + "My Sites" list
- [x] M4: Multi-tenant auth — sign in/up, sign out, password change, admin team management, org data isolation (all verified against the live database)
- [x] M5: HubSpot sync on package creation (Securafy only)
- [x] M6: Photoreal desk-scene template art, properly aligned
