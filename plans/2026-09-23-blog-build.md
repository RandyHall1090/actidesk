# Blog build — plan index

**Status:** in progress.
**Source:** `spec/blog-sop-compliance-instructions.md` (2026-09-19 audit + 2026-09-23 update).

## Governance gate — unchanged, still in force

The Multi-Brand Blog Writing SOP does not yet list ActiDesk as an approved
property, and no automated generation exists here yet at all. **Building the
blog infrastructure itself (schema, public pages, admin dashboard) does not
require that sign-off** — it's only AI-generated content that's gated. No
phase below wires up automated generation; that stays out of scope until
Randy/Jillian approve a property profile (3 internal-link URLs, CTA, image
direction, prohibited claims) and separately decide on the Recraft image-gen
cost, exactly like the sibling `blog-sop-compliance-instructions.md` docs.

## Phases

1. **Schema** — `blog_authors` + `blog_posts`, deliberately NOT `org_id`-scoped
   (this is a platform-wide marketing feature, not a per-tenant one — every
   other table in this repo is org-scoped, this is the one exception).
   RLS enabled, no policies (service-role only), matching every sibling
   property's pattern.
2. **Seed authors** — Randy, Ric, Jillian (`joco@securafy.com`). Rodney
   deliberately excluded for now, per this repo's own compliance doc:
   his ops/security lens is "a stretch" for ActiDesk's sales-enablement
   subject matter unless framed around running an outbound program: start
   with fewer than 4 if the topic space doesn't honestly support four
   distinct angles yet.
3. **Public blog pages** — new top-level `/blog` and `/blog/[slug]` routes
   (outside the `(dashboard)` route group, alongside the existing public
   `/s/[slug]` and `/login` pattern — `/` stays the login/dashboard). Search
   by keyword/author/subject/date range, matching Forge University's
   `/blog` page.
4. **Admin dashboard** — `/admin/blog` under the existing `(dashboard)/admin`
   area, gated the same way as `/admin` itself (`is_platform_admin`).
   List with status badges, Approve/Reject (gated to the post's own author
   by email match, like every sibling property), "+ New post" form with a
   manual scheduled-date override.
5. **Calendar-aware scheduling** — per-author `nextOpenPublishDate`, weekday
   only, matching Forge University's model. Public query filters
   `published_at <= now()` so a scheduled post isn't visible early.
6. **Author-scoped review email** — reuse the existing `sendEmail()` helper
   (`src/lib/email.ts`); notify only the post's own author when it enters
   `pending_review`.

## Explicitly out of scope this pass

- Automated AI content generation (cron, validation pipeline, Recraft
  images) — blocked on the property-profile sign-off and the image-gen
  cost decision, per the compliance doc's own "Tasks" §7.
