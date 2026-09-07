# PRD — Securafy Online Shock-and-Awe Portal

> Product Requirements Document.

## 1. Summary
An internal portal that lets Securafy sales reps build and send a fully personalized, trackable "Online Shock-and-Awe" package to a prospect ahead of a meeting — a branded, photoreal desk-flat-lay page containing a video, audio message, business card, magazine feature, personal letter, and brochures — then see when and how the prospect engages with it.

## 2. Problem
Reps have no fast way to send a prospect a rich, credibility-building package before a first meeting. TMT's Shockbox tool (dashboard.technologymarketingtoolkit.com/shockbox) proves the format works — a personalized "pre-meeting materials" site — but it's a third-party tool on TMT's account/branding. Securafy needs its own version, wired into its own asset library and CRM (HubSpot).

## 3. Users
- Primary user: Securafy sales reps (the whole team, not just one person)
- Their goal: send a prospect a memorable, trust-building package minutes after booking a meeting, with zero design effort
- Current pain: no in-house equivalent exists; TMT's version isn't Securafy's to control, extend, or integrate with HubSpot

## 4. Goals
- A rep can generate a personalized package for a named prospect in a few minutes
- The generated page looks and feels like the TMT example (desk flat-lay, not a plain list of links)
- Sending a package logs/updates the prospect in HubSpot automatically
- Reps can see whether and how a prospect engaged after sending

## 5. Non-goals (v1)
- Multiple selectable page templates/layouts (shipping with one fixed layout)
- The app emailing prospects directly (reps send the link themselves)
- Wildcard per-rep subdomains (using path-based URLs for v1)
- Self-hosting raw video/audio files (linking out to Vimeo instead)

## 6. Features
| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Asset library | Company-wide + personal libraries for video, audio, images, documents, business cards, logo |
| P0 | Create package | Form to enter prospect info and pick/upload an asset for every slot (video, audio, business card, magazine, letter text, brochures) |
| P0 | Desk-flat-lay renderer | Public page at a unique URL rendering the personalized template with all chosen assets, playable/openable |
| P0 | Tracking | Log page views and per-asset opens/plays; surface in a "My Sites" list per rep |
| P0 | HubSpot sync | Upsert the prospect as a HubSpot contact and log a timeline event when a package is created |
| P1 | Company vs. personal library permissions | Admin manages company-wide assets; reps manage their own on top |
| P2 | Additional templates/layouts | More desk-scene variants beyond the v1 layout |

## 7. User flow
1. Rep logs in, clicks "Create Package"
2. Enters prospect name/company/email
3. Picks or uploads a video, audio message, business card, magazine cover, writes/edits the letter body, and picks brochures — from their library, the company library, or fresh upload
4. Clicks "Create" → gets a unique URL
5. Rep copies the link and sends it to the prospect themselves (their own email/Outlook)
6. Package is upserted into HubSpot as a contact + timeline event
7. Prospect opens the link, sees the personalized desk-scene page, plays/opens content
8. Rep checks "My Sites" to see it was opened and what was engaged with

## 8. Success metrics
- Time to create and send a package: under 5 minutes
- % of sent packages opened by the prospect
- Adoption: number of active reps creating packages per week

## 9. Risks & open questions
- Risk: the desk-scene template art needs to be pixel-accurate across screen sizes (video/audio overlays must align with the tablet/phone graphics) → mitigate with careful responsive design and early mobile testing
- Risk: fully-custom-per-send personalization means a longer create-package form → mitigate with sensible library defaults so reps aren't forced to upload something new every time
- Decided: public URLs live on a subdomain of securafy.com (e.g. `shockandawe.securafy.com/s/[slug]`), not a separate purchased domain — exact subdomain name to be finalized at deploy time
- Decided: no asset import/migration needed — Randy will seed the Company Library by uploading marketing assets directly through the app once the library UI exists
- Open question: video/audio hosting — assuming Vimeo (unlisted) links rather than self-hosted files; confirm before building the upload flow

## 10. Milestones
- [ ] M1: Asset library (upload/list video, audio, images, documents) working for one user
- [ ] M2: Create-package form + desk-flat-lay renderer working end-to-end for one template
- [ ] M3: Tracking (page view + asset-open events) + "My Sites" list
- [ ] M4: HubSpot sync on package creation
- [ ] M5: Multi-rep auth + company/personal library split
