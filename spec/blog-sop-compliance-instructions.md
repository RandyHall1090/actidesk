# Blog SOP Compliance — Instructions for ActiDesk's Claude Session

**Origin:** written 2026-09-19 by a cross-repo audit run from the Actiforge
repo, as part of a portfolio-wide decision to give ActiScore, ActiScan, and
ActiDesk each their own auto-generated blog, modeled on Forge University's
implementation and governed by Securafy's CMO-owned Multi-Brand Blog Writing
SOP. This file is self-contained — read it, don't assume the Actiforge repo
or that conversation is available to you.

Also see `spec/plan.md` in this repo for ActiDesk's own product context —
this file only covers the new blog/marketing-content workstream.

## Governance gap — read this first

The Multi-Brand Blog Writing SOP (`Multi-Brand-Blog-Writing-SOP 2026.docx`)
currently names only four content properties: Securafy, Securafy AI Lab,
Forge University, and ActiForge. ActiDesk is not yet formally in that list,
and the SOP requires a CMO-approved "property profile" (audience, voice,
approved topic boundaries, 3 exact approved internal-link URLs, approved
CTA, image direction, prohibited claims) before any generation runs — see
SOP §2, §13. **This repo has nothing to inherit from — get that sign-off
before writing a single line of generation code, not after.**

## Why ActiDesk needs its own blog

ActiDesk's product itself is genuinely horizontal (any sales rep, any
industry — see the ActiDesk sub-brand pages built 2026-09-19 in the
Actiforge repo at `/actidesk`), not MSP-exclusive like the rest of the
Actiforge catalog. A dedicated `actidesk.ai` marketing site (this repo, or a
successor built from it) needs its own content engine rather than
inheriting Actiforge's MSP-framed one.

## The reference implementation to copy from

Forge University (`C:\Users\RandyGHall\DEV\Forge University`, if you have
access to that machine/path — otherwise ask Randy for the relevant file
contents) is the SOP-compliant reference. Key facts:

- **Schema**: `posts` table with `seo_title` (≤65 chars), `meta_description`
  (70-160 chars), `image_alt_text` (≤125 chars), `cover_image_url`, `status`
  enum (`draft`/`pending_review`/`published`/`rejected`). `authors` table
  with 4 rows (Randy, Rodney, Ric, Jillian), each with a `voice_prompt`
  matching their SOP §3 subject-matter lens (see migration files
  `supabase/migrations/20260816_posts_table.sql`,
  `20260828_blog_seo_fields.sql`, `20260816_authors_table.sql`,
  `20260828_blog_sop_authors.sql`).
- **Validation** (`lib/blog-agent.ts`,
  `app/api/cron/generate-blog-post/route.ts`): hard-blocks on a prohibited
  word/phrase list, em-dashes, semicolons, emojis, an H1 inside the article
  body, an internal-link count that isn't exactly 3, a citation count
  outside 4-7 (each citation verified via web_search before insert),
  auto-truncates `seo_title`/`image_alt_text` at word boundaries, and
  rejects a topic that duplicates the last 20 posts' angle.
- **Images**: Recraft API, 16:9 WebP, stored in Supabase Storage
  (`blog-covers` bucket).
- **Cron**: one author per weekday hour slot (`vercel.json`), either
  manual-review (pending_review + Resend email) or auto-publish to the next
  open calendar slot — toggle lives in `/admin/blog`.

## Key SOP rules (condensed — the full doc has more detail on voice/tone)

- Every article needs: title + distinct SEO title (≤65 chars), a clean
  hyphenated slug, meta description (70-160 chars, states reader benefit),
  a 2-4 sentence listing summary distinct from the meta description,
  ~1,500 words, a 1600×900 featured image with alt text (<125 chars),
  4-7 verified external citations, and **exactly 3 internal links** (one
  primary offering page, one supporting resource, one pillar/conversion
  asset) — no more, no fewer, no duplicates, no invented slugs.
- No H1 inside the article body (the platform supplies the page H1). At
  least 2 question-style headings, answered directly in the first 2-3
  sentences beneath them. A 40-60 word direct-answer paragraph near the top.
  Paragraphs of 2-4 sentences. Max 2 bulleted lists and 1 table.
- Prohibited words: accordingly, additionally, moreover, thus, robust,
  seamless, innovative, cutting-edge, game changer, circle back, touch
  base. No em-dashes, semicolons, emojis, hashtags, asterisks-as-formatting,
  or competitor callouts.
- Every article is a draft until a human approves it — no system may
  publish, schedule, or promote it without that approval.

## ActiDesk's current state (audited 2026-09-19)

This repo is a **pure authenticated application** today — no blog, no
public marketing site at all. `/` is the login/dashboard, not a homepage.
This is the fullest build of the three sibling products.

- Stack: Next.js 16.3.4 (App Router), TypeScript, Tailwind CSS 4, Supabase
  (Postgres + Storage), Vimeo (video/audio hosting), Stripe, Resend.
- Every existing table uses `org_id`-scoped Row-Level Security for
  multi-tenant isolation (real customer organizations licensing ActiDesk).
- Auth: Rep / Org Admin / Platform Admin tiers already exist, with server
  actions in `/app/(dashboard)/admin/actions.ts` and
  `/app/(dashboard)/team/actions.ts` as the pattern to follow for a blog
  approval action.
- Design system is minimal/functional today (Geist font, simple light/dark
  toggle, no design tokens file) — the one place real visual effort went is
  the desk-scene template artwork for the public `/s/[slug]` package pages.
  A real marketing site (and its blog) will need real design investment,
  not a reuse of the dashboard's minimal look.
- Production: the application is live at `premeeting.actiforge.ai`; per
  `spec/plan.md` (task T32), the GitHub repo, Vercel project, and Supabase
  project names have not yet been renamed off the old "Online Shock and
  Awe" naming — confirm current naming before assuming.

## Tasks

1. **Stand up a public route group** separate from the authenticated
   dashboard — the blog cannot hang off the current homepage, which is the
   login/signup flow.
2. **Build the schema from scratch**, copying Forge University's exact
   `posts`/`authors` table structure (migration files cited above).
   **Critical**: do NOT scope the blog tables by `org_id` the way every
   other table in this repo is scoped. The blog is a platform-wide
   marketing feature about the product itself, not a per-tenant customer
   feature — an implementer pattern-matching the rest of the schema will
   get this wrong by default if not told explicitly.
3. **Port Forge University's full validation pipeline** from scratch
   (`lib/blog-agent.ts` as the template) — prohibited terms, punctuation/
   emoji/H1 checks, internal-link and citation-count enforcement,
   char-limit truncation.
4. **Set up Recraft-based 16:9 WebP cover-image generation** matching
   Forge University. Check whether a Recraft account/API key already
   exists at the Securafy-org level before provisioning a new one.
5. **Set up a weekday cron schedule** (`vercel.json`, one author per hour
   slot). Pick author lenses deliberately for ActiDesk's actual subject
   matter: Randy (business-strategy/ROI on sales enablement) and Ric
   (procurement/vendor-accountability) fit naturally; Jillian
   (demand-gen/marketing) fits; Rodney's ops/security lens is a stretch
   here unless framed around running an outbound program. Start with fewer
   than 4 authors if the topic space doesn't honestly support four
   distinct weekly angles yet — the SOP's own "topic gate" (§4) would
   reject forced differentiation anyway.
6. **Reuse the existing Resend integration** already present in this repo
   for pending-review notification emails, matching Forge University's
   mechanism.
7. **Before writing any generation code**: get a CMO-approved property
   profile for ActiDesk (see "Governance gap" above) — 3 real internal-link
   URLs, the approved CTA, image-direction guidance for a horizontal
   sales-enablement audience (not MSP-specific), and any prohibited
   claims.
