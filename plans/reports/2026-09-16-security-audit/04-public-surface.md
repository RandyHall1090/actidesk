# Security Audit — Public Unauthenticated Surface (`/s/[slug]`)

Scope: `src/app/s/[slug]/*`, `src/lib/tracking.ts`, `src/lib/assets/*`, and the
public-lookup migrations (0004, 0012, 0021, 0022, 0016–0018). Read-only audit,
no files modified.

---

## Finding 1

- **Severity**: High
- **Title**: Package slug is brute-forceable — low-entropy random suffix, no rate limiting
- **File:Line**: `src/lib/packages/slug.ts:10-18`, `src/app/(dashboard)/packages/new/actions.ts:128-134`
- **Description**: The public page's *only* access control is knowledge of the exact slug (by design — see the comment in `0004_public_package_lookup.sql`: "there is no way to browse without already knowing an exact slug"). The slug is `slugify(prospectName) + "-" + randomSuffix(5)`, where `randomSuffix` draws 5 characters from a 36-character alphabet (`a-z0-9`) using `Math.random()`:
  ```ts
  const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
  export function randomSuffix(length = 5): string {
    let out = "";
    for (let i = 0; i < length; i++) {
      out += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)];
    }
    return out;
  }
  ```
  That's only 36⁵ ≈ 60.5 million possible suffixes (~26 bits of entropy), generated with a non-cryptographic PRNG. The human-readable prefix (`slugify(prospectName)`) is fully deterministic and, for a named/targeted prospect, is either already known to an attacker (LinkedIn, company site, email) or trivially guessable. There is no rate limiting anywhere in the app (`grep` for rate-limit logic and for `middleware.ts` at the route level found nothing) and `get_package_by_slug`/`get_package_assets_by_slug` are plain SECURITY DEFINER RPCs callable directly over PostgREST with the public anon key — no CAPTCHA, no lockout, no exponential backoff.
- **Exploit scenario**: An attacker who knows (or can guess) a specific prospect's name and the tenant sending them a package (e.g. "Securafy is meeting Acme Corp's CISO next week") can compute the slug prefix and script ~60M requests against `get_package_by_slug`. At even a modest unthrottled rate this is hours-to-days of work, not "computationally infeasible" — and since the slug is the *entire* authorization boundary, a successful guess discloses that prospect's name, company, custom sales letter, business card, brochures/magazines (PDFs), and the org's branding/logo — a full disclosure of confidential sales material and prospect PII to an outsider, potentially a competitor.
- **Recommendation**: Increase the random component's entropy and use a CSPRNG. Concretely, generate the whole slug (or at least the discriminator suffix) from `crypto.randomUUID()` or `crypto.getRandomValues()` with at least 16-20 random alphanumeric characters (matching the same unguessability already used for storage paths in `buildAssetStoragePath`, which uses `crypto.randomUUID()`). Decouple the public token from the human-readable prospect name (e.g. keep the pretty slug for the dashboard URL only, and use a separate long random token in the `/s/` URL) so the prefix can't be pre-computed by anyone who knows the prospect's name. Add basic rate limiting / anomaly detection on `get_package_by_slug` calls (e.g. via a Supabase Edge Function proxy or an API gateway) as defense in depth.

---

## Finding 2

- **Severity**: Medium
- **Title**: `tracking_events` INSERT policy accepts any existing `package_id` and unconstrained `slot_name`, with no rate limiting
- **File:Line**: `supabase/migrations/0001_initial_schema.sql:169-170` (`tracking_events_insert_public ... with check (true)`), `src/lib/tracking.ts:13-29`
- **Description**: The public page inserts tracking rows directly from the browser using the anon key:
  ```ts
  const { error } = await supabase.from("tracking_events").insert({
    package_id: packageId,
    event_type: eventType,
    slot_name: slotName ?? null,
  });
  ```
  The RLS policy backing this is `with check (true)` — the only real constraints are the foreign key (`package_id` must reference an existing row in `packages`, any org) and a CHECK constraint restricting `event_type` to `'page_view' | 'asset_opened' | 'asset_played'`. There is **no** check that `package_id` corresponds to the slug actually being viewed, **no** constraint on `slot_name` (free `text`, unbounded length, any value), and no rate limiting or dedup. Since the caller uses the browser anon key directly (not a server route), anyone can call this endpoint directly (curl/devtools), not just through the rendered page.
- **Exploit scenario**: (a) An attacker with the anon key (public by definition in a Supabase client app) and any known `package_id` (trivial for their own package — it's shipped in the page's props/RSC payload; harder but not impossible for another org's if a UUID ever leaks elsewhere, e.g. logs, HubSpot payloads, screen-shares) can flood that package's Activity log with fabricated events — fake "asset_opened" events for slots that were never opened, giving the rep false engagement signals, or a large volume of junk rows (no size cap on `slot_name`) causing storage bloat / noisy dashboards. (b) Because there's no per-IP/per-package throttling, this is also a trivial low-cost DoS/cost-inflation vector against the Supabase project.
- **Recommendation**: Replace the direct table insert with a SECURITY DEFINER RPC (`log_public_event(p_slug text, p_event_type text, p_slot_name text)`) that re-derives `package_id` from the slug server-side (mirroring `get_package_by_slug`'s pattern) instead of trusting a client-supplied `package_id`, and validate `slot_name` against a known allow-list (or at minimum cap its length via a CHECK constraint). Add basic rate limiting per package/IP if abuse is observed.

---

## Finding 3

- **Severity**: Medium
- **Title**: All public-page asset signed URLs use a 1-year TTL with no revocation on package/asset deletion
- **File:Line**: `src/app/s/[slug]/page.tsx:64-71` (documents/images/business card/pen/book images), `src/app/s/[slug]/page.tsx:85-88` (org logo)
- **Description**: Every storage-backed slot asset rendered on the public page — not just the org logo — gets a signed URL with a 1-year expiry:
  ```ts
  const { data: signed } = await supabase.storage
    .from("assets")
    .createSignedUrl(
      row.storage_path,
      60 * 60 * 24 * 365, // 1 year -- matches the org logo below
      row.kind === "document" ? { download: `${row.name}.pdf` } : undefined,
    );
  ```
  Supabase signed URLs are bearer tokens whose validity is determined by an embedded expiry, not by a live RLS re-check against the current state of `packages`/`package_assets`/`assets`. If a rep later deletes the package (e.g. sent to the wrong person, deal fell through, GDPR erasure request) or removes/replaces an asset, any signed URL already delivered to a prospect (or captured in their browser history, forwarded in an email, cached by a proxy, etc.) keeps working for up to a year regardless.
- **Exploit scenario**: Not an "anonymous internet visitor enumerates data" issue, but a data-retention/revocation gap: a business document (brochure, proposal, magazine PDF) a rep believes was "taken down" by deleting the package remains fetchable by anyone holding the URL for up to 365 days after deletion. This matters for the stated threat model (MSSP client-facing tool) since the documents in question can include pricing/proposal content.
- **Recommendation**: Confirm this TTL is an intentional product decision (the code comments suggest it was for the logo specifically, then applied uniformly to documents too) — if not, shorten the TTL for prospect-facing documents to something re-signed per visit at a much shorter interval (the page already re-signs on every load, so a short TTL, e.g. 1 hour, costs nothing functionally and closes the revocation gap). If the 1-year TTL is intentional (e.g., to support an emailed/forwarded link staying alive), document that a deleted package does not revoke previously issued links.

---

## Finding 4 (Info)

- **Severity**: Info
- **Title**: `get_layout_by_id` RPC is not scoped to the requesting package's org
- **File:Line**: `supabase/migrations/0015_org_custom_layouts.sql` (`get_layout_by_id(p_id uuid)`, granted to `anon, authenticated`)
- **Description**: `getLayoutForPublicPage(pkg.template_id)` resolves a custom org layout via `get_layout_by_id(p_id uuid)`, which does a plain `where id = p_id` with no `org_id` check. `template_id` itself is validated against the creating org at package-save time (`resolveTemplateId` in `actions.ts`), so a legitimate request always resolves the correct org's layout — this function can't be reached with an attacker-controlled `p_id` through the normal page flow. If called directly (with a guessed/leaked layout UUID), the only data disclosed is desk-scene layout geometry and a public `layout-backgrounds` bucket image path — the bucket is already `public: true` and the code's own comments treat this content as "branding, not secret," consistent with the org-logo reasoning elsewhere in this app.
- **Exploit scenario**: None identified beyond disclosing a competitor's custom desk-layout design (non-sensitive, already public-bucket content) if a layout UUID (128-bit random) were somehow known.
- **Recommendation**: No action required given the explicit non-secrecy of layout/branding content; flagged only for completeness / defense-in-depth if that assumption ever changes.

---

## Verified NOT vulnerable

**1. `private_note` / other rep-internal fields are not returned to the browser at the query level.**
Traced every version of the public lookup RPC:
- `0004_public_package_lookup.sql` → `get_package_by_slug`: `id, slug, prospect_name, prospect_company, letter_body, template_id`
- `0012_package_lookup_org_branding.sql` → adds `org_name, org_logo_storage_path`
- `0022_package_lookup_calendar_url.sql` (current) → adds `calendar_url`
- **Final/current column list returned by `get_package_by_slug`**: `id, slug, prospect_name, prospect_company, letter_body, template_id, org_name, org_logo_storage_path, calendar_url`
- **`get_package_assets_by_slug`** (unchanged since 0004): `slot_name, kind, name, storage_path, external_url`

`private_note` and `prospect_email` are real columns on `packages` (confirmed in `0001_initial_schema.sql:45` and used by the authenticated dashboard in `src/app/(dashboard)/packages/[slug]/page.tsx` and `.../new/actions.ts`) but are **not selected** by either public RPC — excluded at the SQL level, not just hidden in the UI.

Additionally verified the actual props crossing the server→client boundary in `page.tsx` → `<PackageView>`: `packageId, layout, prospectName, letterBody, slots, orgName, orgLogoUrl, calendarUrl`. Note `pkg.prospect_company` is fetched server-side (it's in the RPC's return type) but is **never passed as a prop to the client component**, so — because Next.js Server Components only serialize explicit props across the client boundary — it never reaches the browser's RSC payload either, even though it's present in the server-side object. The exact data shape reaching the browser is therefore: `packageId` (uuid), `layout` (design config, no secrets), `prospectName`, `letterBody`, `slots[]` (`{slot, kind, name, url}` — pre-signed URLs, not raw storage paths), `orgName`, `orgLogoUrl` (signed URL), `calendarUrl`.

**2. Cross-tenant / blended-org data.** `get_package_by_slug` joins `packages p join orgs o on o.id = p.org_id` and the logo subquery is scoped `a.org_id = p.org_id` — every field returned is derived from the single package matched by the exact slug and its own org; there is no code path that could mix branding/content from a different org.

**3. Signed URL scope for documents/images/video.** Confirmed the full chain: `get_package_assets_by_slug` only returns rows already joined through the requested slug's package; the anon `createSignedUrl` call is additionally re-gated by storage RLS (`assets_storage_select_public_via_package` / `assets_storage_select_public_logo`), which since `0018_fix_public_storage_signing_root_cause.sql` delegates to SECURITY DEFINER boolean functions (`asset_public_via_package`, `asset_public_company_logo`) rather than a blanket policy. Every `storage_path` embeds a `crypto.randomUUID()` component (`src/lib/assets/storage-path.ts`), so guessing a valid path is infeasible even if the boolean-oracle policy were probed directly. The `assets` storage bucket itself is private (`public: false`, `0003_assets_storage_bucket.sql`). An asset row belongs to exactly one org by construction, so "is this path attached to *any* package" (the RLS check) can never cross an org boundary in practice.

**4. Anonymous write access (`tracking_events`).** `event_type` is constrained by a DB `CHECK` to exactly `page_view | asset_opened | asset_played` — an attacker cannot inject arbitrary event types. `slot_name` is unconstrained (see Finding 2), but confirmed it is rendered safely: `src/app/(dashboard)/packages/[slug]/page.tsx:94-95` renders `{e.event_type}` and `{e.slot_name}` as plain JSX text nodes (no `dangerouslySetInnerHTML`), so React's default escaping applies — **no stored XSS** is possible via this vector even though the underlying data isn't validated.

**5. Reflected/stored XSS on the public page.** Searched all of `src/app/s/**` for `dangerouslySetInnerHTML`, `srcdoc`, and `__html` — none found. The two `<iframe>` uses (`DeskScene.tsx:248,262`) only ever receive `toVimeoEmbedUrl(video.url)`, where `video.url` is the rep-entered `external_url` on the `assets` table (trusted tenant input, not prospect-controlled) — not user/prospect input. `prospectName`, `prospect_company` (unused), and `letterBody` are all rendered as plain JSX text (`{prospectName}`, `{letterBody}`) — React-escaped by default.

**6. PDF.js version and scripting.** `package.json` pins `"pdfjs-dist": "^6.3.289"`; the installed `node_modules/pdfjs-dist/package.json` version is `6.3.289`. Checked against known CVEs:
   - CVE-2026-16633 (arbitrary JS execution via a malicious PDF when `enableScripting` is true) affects 5.6.83–6.2.107, fixed in 6.2.108 — **6.3.289 postdates the fix**.
   - CVE-2024-4367 (arbitrary JS execution when `isEvalSupported` is true) affects everything before 4.2.67 — also long since fixed.
   Additionally, `src/app/s/[slug]/pdfjs.ts` calls `pdfjsLib.getDocument({ url })` directly (the core library API, not the bundled PDF.js *viewer* app) without setting `enableScripting`/`isEvalSupported`, and `grep` for those options across `src/` found no occurrences — so scripting is not opted into regardless of version. Documents rendered are always `storage_path`/`external_url` values sourced from the org's own `assets` table (rep-uploaded), never an arbitrary prospect-supplied URL — confirmed via `get_package_assets_by_slug`'s fixed column set and `PackageView`'s `SlotAsset` type.

**7. Open redirect (calendar CTA).** `calendar_url` is set only by the authenticated rep themselves via `updateCalendarUrl` (`src/app/(dashboard)/account/actions.ts:18`), validated with `/^https?:\/\//i` before being written to `profiles.calendar_url` — a `javascript:` or other non-http(s) scheme is rejected at write time. On the public page (`PackageView.tsx:124-131`) it's rendered as a plain outbound link with **both** `target="_blank"` and `rel="noopener noreferrer"` — no reverse-tabnabbing risk, no way for a prospect-facing input to influence this URL (it is entirely rep-controlled, not attacker-controlled from the public surface).

Status: DONE
Summary: 4 findings (1 High — brute-forceable slug from a weak `Math.random()`-based 5-char suffix with no rate limiting; 2 Medium — overly permissive `tracking_events` insert policy and 1-year non-revocable signed URLs; 1 Info — unscoped-but-non-sensitive layout RPC); `private_note` was confirmed excluded at the SQL/RPC level in every migration version and never reaches the browser, and no cross-tenant data blending was found anywhere in the public lookup path.
