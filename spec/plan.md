# spec/plan.md — Securafy Online Shock-and-Awe Portal

> Implementation plan. This is the build map, not the product spec (that's PRD.md).

## 1. Overview
A Next.js + Supabase app with two surfaces: an internal rep/admin dashboard (asset library, package creation, tracking) and a public renderer that serves the personalized desk-flat-lay page at a unique URL per prospect. Modeled on TMT's Shockbox tool but built and owned in-house, wired into HubSpot.

## 2. Architecture
- **Frontend/Backend**: Next.js (App Router) — one app, route groups for `(dashboard)` [authenticated] and `s/[slug]` [public]
- **Auth & DB**: Supabase (Auth + Postgres + Storage)
- **Video/audio hosting**: Vimeo (unlisted) — app stores the Vimeo video/audio ID and embeds via player
- **Document/image storage**: Supabase Storage (brochures, business card images, magazine cover, letter content)
- **CRM sync**: HubSpot API — upsert contact + log a timeline event on package creation
- Data flow: rep action in dashboard → writes `packages` + `package_assets` rows → generates slug → public route reads that data server-side to render → prospect interactions write `tracking_events` rows → dashboard reads them back for the "My Sites" view

## 3. Tech decisions
- **Next.js + Supabase** — matches workspace default stack, fastest path to auth + Postgres + storage without standing up separate services
- **One fixed template for v1** — avoids building a template/layout engine before proving the core workflow; hardcode slot positions for the single desk-scene layout
- **Vimeo for video/audio** — avoids self-hosting large media, re-encoding, and bandwidth costs; Vimeo tooling is already available
- **Path-based URLs, not wildcard subdomains** — avoids wildcard DNS/SSL setup for v1
- **Rep sends the link themselves, app doesn't email prospects** — avoids transactional email deliverability/domain setup for v1
- **HubSpot sync on create** — keeps the CRM as source of truth for prospect activity, matching the rest of Securafy's marketing/sales tooling

## 4. Milestones
- [ ] M1: Auth + asset library (upload/list video/audio/image/document, personal vs. company scope)
- [ ] M2: Desk-scene template art (background image + defined slot coordinates) — design sub-task
- [ ] M3: Create-package form + public renderer working end-to-end
- [ ] M4: Tracking events + "My Sites" list
- [ ] M5: HubSpot sync
- [ ] M6: Multi-rep permissions polish (company library admin controls)

## 5. Tasks
| ID | Task | Depends on | Done when |
|----|------|-----------|-----------|
| T1 | Set up Next.js + Supabase project, auth, base schema | — | Rep can log in; empty dashboard loads |
| T2 | Asset library CRUD (video/audio/image/document, personal+company scope) | T1 | Rep can upload/list/delete assets in each category |
| T3 | Desk-scene template artwork + slot coordinate mapping | — | Background image exists with documented pixel positions for each slot |
| T4 | Create-package form (all slots) + slug generation | T2 | Submitting the form creates a `packages` row and a working URL |
| T5 | Public renderer at `/s/[slug]` | T3, T4 | Visiting the URL shows the personalized desk scene with real content playable |
| T6 | Tracking events (page view + per-slot open/play) | T5 | Events appear in `tracking_events`; visible in a "My Sites" list |
| T7 | HubSpot sync on package creation | T4 | Creating a package upserts a HubSpot contact + logs a timeline event |
| T8 | Multi-rep permissions (admin vs rep, company library edit rights) | T2 | Reps see company assets read-only; admins can add/edit them |

## 6. Testing
- Unit: slug generation/uniqueness, asset-scope permission checks, HubSpot payload construction
- Integration: create-package → public page render → tracking event write, end to end
- Manual check: create a real package as a test prospect, open the link on desktop and mobile, confirm every slot renders and tracking fires

## 7. Open questions
- Exact domain to use for public URLs (a new branded domain vs. a subdirectory of an existing Securafy domain)
- Where existing marketing assets (videos, brochures) currently live, to seed the initial Company Library
- Expected volume (packages/month) — informs whether Supabase's free/starter tier is sufficient
