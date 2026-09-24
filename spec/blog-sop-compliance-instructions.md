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

> **Superseded 2026-09-24:** the marketing site (formerly the separate
> `ActiDesk-Website` repo) now lives in this repo at `/`, the app moved to
> `/dashboard`, and the blog renders inside the marketing layout at
> `www.actidesk.ai/blog`. Internal blog links are site-relative paths for
> the same reason. The audit notes below describe the state before that.

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

1. ~~Stand up a public route group~~ — **done.** Top-level `src/app/blog/`
   and `src/app/blog/[slug]/`, outside `(dashboard)`, added to the auth
   middleware's public allowlist alongside `/s/` and `/login`.
2. ~~Build the schema from scratch~~ — **done**, migration
   `0036_blog_schema.sql`: `blog_authors` + `blog_posts`, NOT `org_id`-scoped
   as warned above. Seeded with Randy, Ric, and Jillian
   (`joco@securafy.com`); Rodney added later (migration 0037, see below) once
   Randy overrode the initial exclusion.
3. ~~Port Forge University's full validation pipeline~~ — **done**
   (2026-09-24, `src/lib/blog-agent.ts`). Prohibited-word list, banned
   punctuation/emoji/H1 checks, and the `<cite>`-artifact defense ported
   exactly. Citation validation also ported exactly as FU actually built
   it, not as the SOP describes it — FU's real code only enforces a floor
   of 4, no ceiling above 7, despite the "4-7" language above; this was
   flagged to Randy and he chose to match the reference rather than fix
   the gap FU itself never closed.
4. ~~Recraft cover-image generation~~ — **done** (2026-09-24,
   `src/lib/recraft.ts`, ported verbatim from FU). Real cost confirmed
   negligible at ActiDesk's volume (~$0.035/image pay-as-you-go, well
   under $1/month) — not a meaningful recurring-cost decision in
   practice.
5. ~~Weekday cron schedule for automated generation~~ — **done**
   (2026-09-24, `supabase/migrations/0038_blog_generation_cron.sql`).
   Matches FU's actual cadence exactly per Randy's explicit direction:
   all 4 authors, every weekday, one hour apart (13:00-16:00 UTC) — not
   the lighter "one post per author per week" this file originally
   floated as an option. What was already done before this: calendar-
   aware *publish* scheduling for posts however they're authored —
   `src/lib/blog.ts`'s `nextOpenPublishDate`/`resolvePublishedAt`, a
   manual override field on the admin form, and the public query's
   `published_at <= now()` filter that makes scheduling real rather than
   cosmetic.
6. ~~Reuse the existing Resend integration~~ — **done.**
   `src/app/(dashboard)/admin/blog/notify.ts` calls the existing
   `sendEmail()` helper, notifying only the post's own author when it
   enters `pending_review` — matches Forge University's "approve only
   your own posts" email pattern exactly. The generation cron
   (`api/cron/generate-blog-post`) calls this same helper directly
   rather than duplicating FU's separate Resend wiring.
7. ~~CMO-approved property profile~~ — **done** (2026-09-24). Randy
   signed off as CEO rather than routing through Jillian (CMO) formally,
   his explicit call to make. Profile grounded in `actidesk.ai`'s real
   live pages (`src/lib/blog-property-profile.ts`): primary offering =
   the homepage, supporting resource = whichever of the 5 real industry
   pages best matches a given post's topic (not one fixed page, since
   ActiDesk's positioning is deliberately horizontal), pillar/conversion
   = `/signup` (the site's own real "Get Started →" CTA target), image
   direction matching the site's actual brand tokens (`#0a0c10` /
   `#00c8ff`), and a prohibited-claims baseline (no ROI/close-rate
   guarantees, no named customer results without permission, no unearned
   certification claims) on top of the SOP's existing rules.

Rodney, excluded above when this file was first written, is included
after all — Randy's explicit direction (2026-09-24): all 4 real Securafy
execs, matching Forge University exactly, not 3. His voice_prompt
(migration 0037) reframes FU's ops/security execution lens around
actually running an outbound sales program, per this file's own original
"unless framed around running an outbound program" hint.

## What shipped 2026-09-23 (see `plans/2026-09-23-blog-build.md`)

The blog subsystem now exists end to end for human-authored content:
public `/blog` with keyword/author/date-range search, `/blog/[slug]`
detail rendered via `react-markdown` (newly added dependency — this repo
had no markdown renderer), and a login-gated `/admin/blog` dashboard
(list + approve/reject + "+ New post") matching Forge University's exact
look and feel, restricted to `is_platform_admin` the same way `/admin`
itself already is. `tsc --noEmit` and `eslint` both clean. Only the
AI-generation pipeline (tasks 3-5, 7) remains, and it's gated on business
decisions, not more code.

## Update — 2026-09-23: Forge University's reference has moved on

Everything above still holds, but Forge University's implementation has grown
four features since the 2026-09-19 audit that this file predates. Since
ActiDesk is being built from scratch, build these in from the start rather
than retrofitting later:

- **Blog search** (`app/blog/page.tsx`): keyword (title/excerpt/category
  `ilike`), author dropdown, subject/category dropdown, and a from/to date
  range, all as URL search params with a "Clear filters" link. This was
  explicitly requested by name ("search by date, author, subject") — build
  it into the initial public blog page rather than adding it later.
- **Calendar-aware scheduling with a manual override**: `lib/blog.ts`'s
  `nextOpenPublishDate(occupiedDateKeys, from)` (skips weekends, finds the
  next date not already occupied by the *same author*) plus
  `getOccupiedPublishDates(supabase, authorId)` in `lib/blog-generation.ts`.
  The admin create/edit/approve actions (`resolvePublishedAt()` in
  `app/admin/blog/actions.ts`) auto-assign the next open slot but accept an
  optional `scheduled_publish_date` override field. The admin list shows
  `"scheduled: <date>"` instead of a misleading "published" for a
  future-dated row (`displayStatus()` in `app/admin/blog/page.tsx`). **The
  public blog and post-detail queries must filter
  `.lte("published_at", now())` in addition to `status = "published"`** —
  without that filter, scheduling is cosmetic and a post is publicly visible
  the moment it's approved regardless of its assigned date.
- **`decline_topic` stop condition** (`lib/blog-generation.ts`): the
  generation tool can decline a run when nothing clears the quality/relevance
  bar instead of forcing a weak article out. `generateArticle()` returns
  `{outcome: "submitted", ...} | {outcome: "declined", reason}`; a decline is
  logged as a **successful, intentional** outcome in the run log, not a
  failure.
- **`<cite>`-artifact defense (real incident, treat as a required fix, not
  an enhancement)**: the model can write literal
  `<cite index="N-M">claim</cite>` wrapper tags directly into article body
  text — a hallucination/imitation of Anthropic's citation format, not a
  real API artifact (real web-search citations are delivered as structured
  metadata on content blocks, never literal inline tags). Fix pattern in
  `lib/blog-agent.ts`: `stripCiteArtifacts(body)` mechanically unwraps
  well-formed `<cite>...</cite>` pairs (safe because the wrapped text is
  always supplementary to, never a replacement for, the article's separately
  required 4-7 real markdown citation links), and `hasCiteArtifact(body)`
  hard-rejects anything that survives the strip (e.g. an unclosed tag). Wire
  this into validation and the system prompt from day one — Forge University
  had to clean up 28 live posts after the fact because it wasn't caught
  early.
