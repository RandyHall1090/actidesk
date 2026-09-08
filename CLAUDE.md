# CLAUDE.md — Online Shock-and-Awe Portal

@AGENTS.md

## What this is
A **multi-tenant** portal for sales reps to create personalized, trackable "Online Shock-and-Awe" pages for prospects ahead of meetings — video, audio, business card, magazine, letter, and brochures rendered on a branded desk-scene template — with engagement tracking. Modeled on TMT's Shockbox tool, but Securafy is the platform operator (and its first tenant), reselling the same tool to its own clients. Every tenant gets fully isolated data and its own logo/branding; see PRD.md and spec/plan.md for the tenant model.

## Stack
- Language: TypeScript
- Framework: Next.js (App Router)
- Package manager: npm
- Datastore: Supabase / Postgres (+ Supabase Storage for documents/images; Vimeo for video/audio)

## Run & test
- Install: `npm install`
- Run: `npm run dev`
- Test: TBD — no test framework chosen yet

## Coding style
- ES modules / async-await where applicable, 2-space indent
- Descriptive variable names (no single letters except loop counters)
- Comment WHY, not WHAT — skip obvious comments

## How to work here
- Read existing code before changing anything
- Small, focused changes — not big rewrites
- Run tests/typecheck after changes before saying done
- If a request seems wrong, ask before proceeding

## Security
- Secrets go in environment variables only — see SECURITY.md
- `.env` is gitignored; never commit secrets

## Project-specific notes
- Modeled on TMT's Shockbox tool (dashboard.technologymarketingtoolkit.com/shockbox) — see spec/plan.md for the exact desk-scene layout being replicated
- **Multi-tenant**: a real `orgs` table; every tenant-scoped row carries `org_id`; a new signup email domain creates a new org (creator becomes admin), a matching domain joins the existing one (as rep). Never add a feature that assumes there's only one company using this app.
- Auth is email+password (not magic links — Securafy's own email security was consuming the one-time login link before it could be clicked; see spec/plan.md Tech decisions)
- v1 ships one fixed template (video + audio + business card + magazine + letter + brochures); multiple layouts are a future feature
- Video/audio are hosted on Vimeo (unlisted), not self-hosted
- Sending a package syncs to HubSpot (portal 46124718) — **Securafy-specific**, not available to other tenants in v1
- Reps send the generated link themselves; the app does not email prospects directly in v1
- Scaffolded on Next.js 16.3.4 / React 19.2.8 — this is a newer major than most training data; AGENTS.md (auto-maintained by `next dev`, imported above) flags framework changes to check before writing App Router code
