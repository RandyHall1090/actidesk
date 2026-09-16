# Security Audit — API Routes, Server Actions: Input Validation, Injection, Authorization Consistency

Scope: `src/app/api/packages/route.ts`, `src/app/api/help-chat/route.ts`, `src/app/(dashboard)/packages/actions.ts`, `src/app/(dashboard)/packages/new/actions.ts`, `src/app/(dashboard)/packages/[slug]/edit/page.tsx`, `src/app/(dashboard)/templates/actions.ts`, `src/app/(dashboard)/templates/layout-designer/actions.ts`, `src/app/(dashboard)/templates/layout-designer/exportLayout.ts`, `src/app/(dashboard)/library/actions.ts`, `src/lib/hubspot.ts`, `src/lib/vimeo.ts`, `src/lib/packages/slug.ts`, `src/lib/packages/layouts.ts`, `src/lib/packages/getOrgLayouts.ts`, `src/lib/packages/slots.ts`, `src/lib/helpChat/content.ts`, `src/lib/tracking.ts`.

Method: full read of every listed file, plus targeted greps across `src/` for raw SQL/`.rpc()`/`.or()`/`.ilike()` filter-string construction, mass-assignment spread patterns, CORS headers, secret usage, and `console.error` leak paths, and a read of `@supabase/postgrest-js`'s `eq()` implementation to confirm exactly how a non-string filter value is serialized.

---

## Finding 1 — `deleteAsset` has no explicit authorization check and no no-op detection (unlike every sibling delete action)

- **Severity**: High
- **Title**: Missing defense-in-depth authorization check on asset deletion; storage file removal proceeds even when the DB delete may have silently affected 0 rows
- **File:Line**: `src/app/(dashboard)/library/actions.ts:134-153` (`deleteAsset`)
- **Description**: Every other mutating action in this codebase follows a documented pattern: call `getCurrentProfile()` first, and after an RLS-governed `delete()`, check `count` (or `!data` on an `update()`/`.select().single()`) to detect a *silent* RLS no-op and turn it into a real error instead of a false "success" (see `packages/actions.ts` `deletePackage`, `templates/actions.ts` `deletePreset`, `templates/layout-designer/actions.ts` `saveLayout`/`saveLayout` update branch). `deleteAsset` breaks this pattern on every axis:
  - It never calls `getCurrentProfile()` — there is no explicit authorization check in the function at all.
  - Its `delete()` call has no `{ count: "exact" }` and never checks whether any row was actually removed:
    ```ts
    const { error } = await supabase.from("assets").delete().eq("id", assetId);
    if (error) return { ok: false, error: error.message };
    ```
  - It has no `.eq("org_id", ...)` / `.eq("owner_id", ...)` scoping either (contrast with `deleteLayout`, which at least adds `.eq("org_id", profile.org_id)` as defense-in-depth even though it also lacks a count check — see Finding 2).
  - Worse, the storage-file removal that follows is **not conditioned on the delete having actually happened** — it only checks that the earlier `SELECT` returned a `storage_path`:
    ```ts
    if (asset?.storage_path) {
      await supabase.storage.from("assets").remove([asset.storage_path]);
    }
    ```
    If the caller can `SELECT` the asset (e.g. it's `scope: "company"` and thus visible org-wide) but RLS denies the `DELETE` (e.g. only the owner or an admin may delete), this code still calls `storage.remove()` on that file's `storage_path`. If Storage's own bucket policy is not at least as strict as the `assets` table's `DELETE` policy, this becomes a real cross-user/cross-permission bypass: a non-owner, non-admin rep could permanently delete the physical file of a shared company asset while its DB row (and every package that references it) survives, leaving a broken asset across the org. Even if Storage RLS is equally strict and also no-ops, the function still reports `{ ok: true }` and calls `revalidatePath("/library")` as if the deletion succeeded.
- **Exploit scenario**: A rep who is neither the owner of a `scope: "company"` asset nor an org admin calls the exposed `deleteAssetFormAction(assetId)` (bound directly to a `<form action>`, and — like any Server Action — independently callable with any `assetId` string, not just ones the UI currently renders for that user) for an asset ID they can see in the library listing but not delete under `assets_delete_*` RLS. Expected: a permission error. Actual (depending on how permissive the `assets` storage bucket policies are relative to the table's row-level policies): the physical file is deleted from Storage regardless, or in the best case, the app claims success (`{ ok: true }`) after doing nothing, leaving the UI/caller with no diagnostic under exactly the condition this codebase already has a named idiom for handling correctly ("RLS silently deletes 0 rows... the count check is what turns that into a real, visible error").
- **Recommendation**: Bring `deleteAsset` in line with `deletePackage`/`deletePreset`: call `getCurrentProfile()` first and return early if unauthenticated; add `.delete({ count: "exact" })` and check `count` before treating the row as gone; only call `supabase.storage.from("assets").remove(...)` after confirming `count > 0` (i.e., the DB row was actually deleted by this call), so storage and DB state can never diverge.

---

## Finding 2 — `deleteLayout` reports false success when the target row doesn't exist or belongs to another org

- **Severity**: Medium
- **Title**: Missing no-op detection on layout deletion (tenant isolation is intact; caller-facing result is wrong)
- **File:Line**: `src/app/(dashboard)/templates/layout-designer/actions.ts:93-112` (`deleteLayout`)
- **Description**: Unlike `saveLayout`'s update branch (which checks `error || !data` on the same table) and unlike `deletePackage`/`deletePreset` (which check `count`), `deleteLayout` does an explicit `.eq("org_id", profile.org_id)` (so tenant isolation itself is *not* broken — a caller can never delete another org's layout) but never checks how many rows were actually deleted:
  ```ts
  const { error } = await supabase
    .from("layouts")
    .delete()
    .eq("id", id)
    .eq("org_id", profile.org_id);
  if (error) return { ok: false, error: error.message };
  ...
  return { ok: true, id };
  ```
  If `id` doesn't exist, was already deleted, or (hypothetically) belongs to a different org, this still returns `{ ok: true, id }`.
- **Exploit scenario**: Not a tenant-isolation bypass (the `org_id` filter prevents that), but a caller who submits a stale or fabricated `id` gets a false "layout deleted" response and a `revalidatePath` that doesn't actually reflect a real change — misleading UI feedback, matching exactly the "silently succeed-looking while actually doing nothing" pattern the audit asked to check for.
- **Recommendation**: Add `{ count: "exact" }` to the `.delete()` call and return an error (`"Couldn't delete the layout — it may not exist."`) when `count` is falsy, matching `deletePackage`/`deletePreset`.

---

## Finding 3 — `template_id` in the Gate Desk route bypasses `optionalString()` validation

- **Severity**: Low
- **Title**: Inconsistent input validation — `template_id` is cast, not validated, unlike every other field on the same endpoint
- **File:Line**: `src/app/api/packages/route.ts:78-79`
- **Description**: `prospect_name`, `prospect_company`, and `prospect_email` all go through `optionalString()`, which throws (caught → clean 400) on any non-string/non-null/non-undefined JSON value. `template_id` does not:
  ```ts
  const rawTemplateId =
    (body?.template_id as string | null | undefined) ?? undefined;
  ```
  This is a bare TypeScript type assertion with no runtime check. I traced the actual runtime consequence through `resolveTemplateId()` (`src/app/(dashboard)/packages/new/actions.ts:22-37`) and into `@supabase/postgrest-js`'s `eq()` (`node_modules/@supabase/postgrest-js/src/PostgrestFilterBuilder.ts:196`, which does `this.url.searchParams.append(column, \`eq.${value}\`)`). A template literal on a non-string `value` just calls `String(value)` (e.g. an object becomes the literal string `"[object Object]"`, a number becomes its digits) — it does not throw, and it cannot inject into the query (it becomes one URL-encoded query-string value, not raw SQL). The lookup then fails to match, and `resolveTemplateId` falls back to `DEFAULT_LAYOUT_ID`. **So this is not exploitable for a crash or for injection** — but it is a real inconsistency with the endpoint's stated design ("a field can be any JSON type... Throws on anything but undefined/null/string") and the audit's specific ask to confirm *all* fields go through the helper.
- **Exploit scenario**: `POST /api/packages` with `{"prospect_name": "Acme", "template_id": {"a":1}}` — no error, no crash; the package is silently created on `DEFAULT_LAYOUT_ID` instead of getting a clear 400 telling Gate Desk its request was malformed. Low impact, but a masked integration bug for Gate Desk's own debugging.
- **Recommendation**: Route `rawTemplateId` through `optionalString(body?.template_id)` (inside the existing try/catch) for a consistent, documented validation contract and a clear 400 instead of a silent fallback.

---

## Finding 4 — No max-length or format validation on free-text and email fields

- **Severity**: Low
- **Title**: Unbounded string fields; no email-format check anywhere a prospect email is accepted
- **File:Line**: `src/app/api/packages/route.ts:21-27` (`optionalString`) and every caller of it; `src/app/(dashboard)/packages/new/actions.ts:55-68`; `src/app/(dashboard)/packages/actions.ts` (n/a — no create); `src/app/(dashboard)/templates/actions.ts:36-41`; `src/app/(dashboard)/library/actions.ts:38-39,87-90`; `src/app/(dashboard)/templates/layout-designer/actions.ts:44-48`
- **Description**: `optionalString()` correctly rejects non-string types but applies no `.length` cap. Every free-text field accepted from a client or the bearer-token Gate Desk caller (`prospect_name`, `prospect_company`, `prospect_email`, `letter_body`, `private_note`, preset `name`, asset `name`, `external_url`, layout `label`) can be arbitrarily long, bounded only by the platform's request-body limit (not present in code) and whatever the Postgres column type allows (typically unbounded `text`). Separately, `prospect_email` is never checked for a valid email shape anywhere it's accepted (Gate Desk route, dashboard `packages/new/actions.ts`) — any string is accepted, trimmed, and stored.
- **Exploit scenario**: A Gate Desk caller (or a caller who obtained/leaked the bearer token) sends a many-megabyte `prospect_name`/`prospect_company` string repeatedly, persisting large rows and inflating storage/DB size with no application-level limit; this is only bounded by whatever the hosting platform enforces on request bodies, not by this code. Separately, `prospect_email: "not-an-email"` is silently accepted and stored, later passed as HubSpot's `idProperty: "email"` in `upsertContact` (`src/lib/hubspot.ts:75-78`) — the HubSpot call will fail server-side (logged via `console.error`, doesn't throw) but the package itself is still created with bad data.
- **Recommendation**: Add a reasonable max length (e.g. 200-500 chars for names/company, larger for `letter_body`/`private_note`) to `optionalString()` or its callers, and a basic email-format check (e.g. a simple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` test) on `prospect_email` before insert, returning 400/an `ActionResult` error instead of silently persisting malformed data.

---

## Finding 5 — `external_url` on link assets is stored with no scheme/format validation

- **Severity**: Low
- **Title**: `createLinkAsset` accepts any non-empty string as a URL, including non-http(s) schemes
- **File:Line**: `src/app/(dashboard)/library/actions.ts:30-65`
- **Description**: `externalUrl` is trimmed and checked only for non-emptiness:
  ```ts
  const externalUrl = (formData.get("external_url") as string | null)?.trim();
  ...
  if (!name || !externalUrl) {
    return { ok: false, error: "Name and a URL are both required." };
  }
  ```
  No check that this parses as an `http(s)://` URL. This value later flows through `toVimeoEmbedUrl()` (`src/lib/vimeo.ts`), which passes any non-Vimeo-matching string through unchanged, and is presumably rendered as a link/embed source on package pages.
- **Exploit scenario**: An org member stores `external_url: "javascript:alert(1)"` or a `data:` URI as a "video"/"audio" asset link. Actual exploitability depends on how the value is rendered downstream (outside this file's scope) — if rendered as an `<a href>` or iframe `src` without a scheme allowlist, most modern browsers already refuse to navigate/execute `javascript:`/`data:` in those contexts from a non-user-typed source, but this is fragile defense to rely on.
- **Recommendation**: Validate `externalUrl` starts with `http://` or `https://` (or use the `URL` constructor and check `.protocol`) before insert.

---

## Finding 6 — Several dashboard Server Actions return raw Supabase `error.message` to the client

- **Severity**: Low
- **Title**: Database error details (constraint/column/table names) are passed through to the caller in several actions
- **File:Line**: `src/app/(dashboard)/packages/actions.ts:24`; `src/app/(dashboard)/packages/new/actions.ts:94,105,122,155,163,182`; `src/app/(dashboard)/templates/actions.ts:58,68,84,105,134`; `src/app/(dashboard)/templates/layout-designer/actions.ts:71,85,106`; `src/app/(dashboard)/library/actions.ts:61,118,142,145`
- **Description**: The two API routes in scope (`/api/packages`, `/api/help-chat`) both correctly return only generic error strings to the caller and log details server-side only (see "Verified NOT vulnerable" below). Several dashboard Server Actions, by contrast, return `error?.message ?? "..."` straight from the Supabase client into the `ActionResult` shown to the browser. These messages are ordinary PostgREST/Postgres errors (e.g. unique-constraint violations, "no rows returned"), not stack traces or file paths, and the caller is always an already-authenticated user acting within their own tenant — so the practical risk is low — but a Postgres error can occasionally include column/constraint/table names, which is more internal detail than a production app should surface verbatim.
- **Exploit scenario**: Low severity / information-disclosure only: an authenticated rep triggering a constraint violation (e.g. a rare slug collision after 3 retries) sees the raw Postgres error text instead of a generic message, potentially learning a column or constraint name.
- **Recommendation**: For these dashboard actions, log `error` server-side (as the two API routes already do) and return a generic user-facing message; reserve the specific message only for validation-type failures the code itself constructs (e.g. "Prospect name is required.").

---

## Finding 7 — Layout Designer JSONB fields accept unvalidated shapes

- **Severity**: Info
- **Title**: `nameplate`/`slots`/`letter`/`brochures` are stored with no runtime shape validation
- **File:Line**: `src/app/(dashboard)/templates/layout-designer/actions.ts:36-91` (`saveLayout`)
- **Description**: `saveLayout` only validates that `label` is non-empty and `backgroundImage` is truthy; `input.nameplate`, `input.slots`, `input.letter`, `input.brochures` are inserted into JSONB columns as-is, typed only at the TypeScript level (`SaveLayoutInput`), with no runtime check that each `SlotPosition` actually has the expected `left`/`top`/`width` string fields. This is safe from SQL injection (JSONB storage, parameterized) and from XSS (these values are later applied via React inline `style` objects — e.g. `element.style.left = value` — which cannot execute script or "break out" into unrelated CSS/HTML the way a raw string concatenated into markup could), and the action is already gated to `profile.role === "admin"` plus RLS scoped to `profile.org_id`, so the blast radius is limited to an org's own admin degrading their own org's layout data.
- **Recommendation**: Optional hardening — validate the expected keys/types of `nameplate`/`slots` entries before insert, for data-integrity defense-in-depth rather than a security fix.

---

## Finding 8 — Edit page fetches the package row before checking ownership

- **Severity**: Info
- **Title**: `packages/[slug]/edit/page.tsx` relies on RLS (not an explicit query filter) for the initial `SELECT`, checking ownership only afterward
- **File:Line**: `src/app/(dashboard)/packages/[slug]/edit/page.tsx:32-51`
- **Description**:
  ```ts
  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select(...)
    .eq("slug", slug)
    .single();
  ...
  if (pkg.created_by !== profile.id) { ... deny ... }
  ```
  The query itself has no `.eq("created_by", profile.id)` (contrast with `savePackage`'s update, which does add that filter). In practice this is **not exploitable**: `profile.id` uniquely identifies one specific user (not just a role), so the follow-up check is exactly as strong as filtering in the query, and no field of `pkg` is rendered before the check runs. This is purely a style/defense-in-depth inconsistency with the rest of the codebase's pattern of pushing ownership into the query itself.
- **Recommendation**: None required; optionally add `.eq("created_by", profile.id)` to the query for consistency.

---

## Finding 9 — Timing side-channel via pre-check length comparison (accepted trade-off)

- **Severity**: Info
- **Title**: `provided.length !== expectedBuf.length` returns before reaching `timingSafeEqual`
- **File:Line**: `src/app/api/packages/route.ts:29-38`
- **Description**: Node's `crypto.timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH_MISMATCH` if given differently-sized buffers, so a length pre-check is unavoidable before calling it — this is the standard, documented pattern (used in Node's own docs and most OWASP examples). The pre-check only reveals whether the *length* of the supplied token matches the secret's length (via a timing difference of a returned `false` before vs. after the `timingSafeEqual` call), never anything about the token's *content*. See "Verified NOT vulnerable" for the full trace of this function.
- **Recommendation**: None required. If maximal caution is desired, the length check could itself be padded to constant time (e.g. always run a fixed-size dummy `timingSafeEqual` call on the length-mismatch path), but this is not standard practice and the residual risk (learning only a fixed token's byte length) is negligible.

---

## Finding 10 — `/api/help-chat` accepts an unbounded `messages` payload

- **Severity**: Info
- **Title**: No size/count cap on chat history before invoking the model
- **File:Line**: `src/app/api/help-chat/route.ts:12-18`
- **Description**: `const { messages }: { messages: UIMessage[] } = await req.json();` is passed straight to `convertToModelMessages` / `streamText` with no length or item-count validation. The route is already gated to authenticated, `is_active` dashboard users only (not multi-tenant, not public), so the realistic risk is limited to an authenticated internal user driving up model-usage cost via oversized requests, not a security boundary bypass.
- **Recommendation**: Optional — cap message count/length if LLM cost control matters; not a security requirement given the auth gate already in place.

---

## Process note (not a code defect): incidental secret exposure during this audit

- **Severity**: Info
- **Title**: A broad grep glob during this audit surfaced live secret values from `.env.local`
- **Description**: While confirming there was no hardcoded fallback for `GATE_DESK_API_KEY`/`SECURAFY_HUBSPOT_TOKEN`, a `Grep` call scoped to `.env*` (intended to check only `.env.example`) also matched `.env.local` and returned its actual secret values into this session's tool output. Verified `.env.local` **is** correctly excluded from git via `.gitignore` (`.env`, `.env.*`, `!.env.example`, `.env*`), so nothing was or will be committed — this is not a codebase vulnerability. Per this project's security baseline ("if you detect an exposed secret, stop and flag it"), flagging it here: the two real key values (for `GATE_DESK_API_KEY` and `SECURAFY_HUBSPOT_TOKEN`) passed through this audit session's context. Neither value is reproduced in this report. Out of an abundance of caution, consider rotating both keys.
- **Recommendation**: Rotate `GATE_DESK_API_KEY` (coordinate with the Gate Desk partner system) and `SECURAFY_HUBSPOT_TOKEN` (HubSpot private app token) if you want to fully close this exposure window; not required by anything found in the application code itself.

---

## Verified NOT vulnerable

- **Bearer token length check before `timingSafeEqual`**: `src/app/api/packages/route.ts:36` checks `provided.length !== expectedBuf.length` and returns `false` *before* calling `timingSafeEqual`, which is required because that API throws on mismatched-length buffers. No unhandled exception path exists (confirmed no missing try/catch is needed here — the length guard prevents the throw entirely).
- **End-to-end constant-time comparison**: Traced the full auth path (`req.headers.get("authorization")` → regex extraction of the token → `Buffer.from` on both sides → `timingSafeEqual`). No `===`, `.includes()`, `.startsWith()`, or other short-circuiting string comparison touches the secret or the provided token anywhere in the path; the regex match (`/^Bearer\s+(.+)$/i`) only checks the literal, non-secret `"Bearer "` prefix format.
- **Missing/empty `GATE_DESK_API_KEY` fails closed**: `if (!expected || !header) return false;` — an unset (`undefined`) or empty-string env var makes `!expected` true, returning `false` (unauthorized) rather than ever reaching a comparison that could pass on `"" === ""`/`undefined === undefined`. Confirmed no other code path reads this env var with a fallback default (grepped the full `src/` tree and `.env.example`; `.env.example` correctly ships this key empty).
- **Gate Desk cannot be used as a multi-tenant bypass**: Read the entire route. Every created package's `org_id` is the hardcoded imported constant `SECURAFY_ORG_ID` (`src/lib/hubspot.ts:12`) and `created_by` is the hardcoded constant `GATE_DESK_SERVICE_PROFILE_ID` (`src/app/api/packages/route.ts:13`). Neither value is ever read from `body` or any other client-supplied input. The only client-influenced lookup (`template_id`) is resolved via `resolveTemplateId(admin, SECURAFY_ORG_ID, ...)`, which explicitly scopes any custom-layout lookup to `SECURAFY_ORG_ID` — a caller cannot smuggle another org's `template_id` into a Securafy-owned package, and cannot set `org_id`/`created_by` to anything else. Confirmed this endpoint cannot create a package under, or leak data from, any tenant other than Securafy.
- **`optionalString()` correctly rejects non-string types**: returns `null` for `undefined`/`null`, throws `Error("Expected a string")` for any other non-string type (number, boolean, object, array), which the route's `try { ... } catch { return 400 }` block turns into a clean 400 response rather than an unhandled 500/TypeError. Verified for `prospect_name`, `prospect_company`, `prospect_email` (see Finding 3 for the one field, `template_id`, that bypasses this helper — confirmed not exploitable for a crash or injection, just an inconsistency).
- **No raw/string-built SQL anywhere**: grepped all of `src/` for `.rpc(` — every call (`find_org_by_email_domain`, `complete_signup`, `get_layout_by_id`, and the two calls in `src/app/s/[slug]/page.tsx`) passes parameters as a named object, never a concatenated/template-literal string. Grepped for `.or(`, `.filter(`, `.textSearch(`, `.ilike(`, `.like(` — every hit is a plain JavaScript `Array.prototype.filter` call on already-fetched data, not a Supabase query-builder filter method; no raw filter-string construction from user input exists anywhere in the app.
- **No mass assignment**: every reviewed server action explicitly destructures/names the fields it writes (no `...formData`, no `...body`, no `Object.fromEntries(formData)` spread into `.insert()`/`.update()` anywhere in `src/`). The one `...spread` found (`saveLayout`'s `{ ...sharedFields, org_id: profile.org_id, created_by: profile.id }`) spreads a locally-constructed object (`sharedFields`) built only from named `input.label`/`input.backgroundImage`/etc. fields — it never contains `org_id`/`created_by` keys, and those two keys are always set explicitly and last (winning any spread-order conflict) from the server-resolved `profile`, never from client input.
- **HubSpot token never leaves the server**: read the entirety of `src/lib/hubspot.ts`. `process.env.SECURAFY_HUBSPOT_TOKEN` is read once, used only in the `Authorization: Bearer` header of two outbound `fetch()` calls, and never appears in any value returned from `syncPackageToHubSpot` (which returns `void`) or logged in full — failures log `res.status` and `res.text()` (HubSpot's own response body describing *why the call failed*, not the token) via `console.error`, server-side only.
- **No real Vimeo API key/token usage exists in this codebase**: `src/lib/vimeo.ts` contains a single pure function (`toVimeoEmbedUrl`) that regex-transforms a pasted watch-page URL into a player-embed URL; it makes no network calls and reads no environment variable. Video/audio "assets" are rep-pasted external link strings (`createLinkAsset`), not fetched via an authenticated Vimeo API. Grepped the whole `src/` tree for `vimeo`/`VIMEO` — confirmed no other file references a Vimeo credential.
- **No CORS headers on either API route**: grepped `src/` for `Access-Control-Allow-Origin`/`cors`/`CORS` — zero matches. Neither `/api/packages` nor `/api/help-chat` sets any CORS response header, so a browser-based cross-origin caller is blocked by the browser's same-origin policy by default; Gate Desk's actual caller is a server-to-server bearer-token client, which is not subject to CORS at all (CORS is enforced by browsers, not relevant to a non-browser HTTP client).
- **No stack traces / internal file paths / raw DB errors leak from either API route in scope**: `/api/packages`'s only failure responses are `{"error": "Unauthorized"}` (401), a field-specific validation message (400), and `{"error": "Could not create package"}` (500) — the actual Supabase error (`lastError`) is logged via `console.error` server-side only, never included in the JSON response. `/api/help-chat`'s catch block returns the plain string `"Something went wrong. Please try again."` (500); the actual `error` object is logged via `console.error` server-side only. (See Finding 6 for a related, lower-severity observation about several *dashboard* Server Actions, outside these two API routes, that do return raw Supabase error text to the already-authenticated caller.)
- **Slug generation cannot carry an injection/path-traversal payload**: `slugify()` (`src/lib/packages/slug.ts:1-8`) lowercases, strips diacritics, and replaces every character outside `[a-z0-9]` with `-` (then trims leading/trailing `-`), before a random alphanumeric suffix is appended. The final slug — used in the public URL, in DB lookups, and embedded in the HubSpot note body (`src/lib/hubspot.ts:110`) — can never contain anything outside `[a-z0-9-]`, regardless of what a caller supplies as `prospect_name`. Client-supplied text is never used as the slug directly in any of the three insert sites (Gate Desk route, `packages/new/actions.ts`).
- **`presets`/`layouts` sharing to `scope: "company"` by any rep is a confirmed, intentional product decision** (not a vulnerability): the code comment in `src/app/(dashboard)/templates/actions.ts:11-20` explicitly documents this as "a deliberate departure... Randy explicitly asked for any rep to be able to share their own template," enforced by RLS (`presets_insert_own`) plus this action's own scoping to `profile.org_id`. Confirmed this is a recorded, accepted decision, not an oversight.
- **Layout Designer admin mutations double-check authorization**: both `saveLayout` and `deleteLayout` explicitly verify `profile.role === "admin"` in application code in addition to RLS (`layouts_insert_admin`/`layouts_update_admin`, both `is_org_admin(org_id)`), and every query is scoped with `.eq("org_id", profile.org_id)`.
- **`src/app/(dashboard)/templates/layout-designer/exportLayout.ts`**: pure string/object formatting with no database access, no user session, and no external input beyond values already validated/typed elsewhere in the Layout Designer UI — confirmed not a security-relevant surface.
- **`src/lib/tracking.ts`**: reviewed as part of scope. It is a `"use client"` fire-and-forget wrapper around a direct `tracking_events` insert from the public `/s/[slug]` page, using the anon Supabase client — any real enforcement of what `package_id`/`event_type`/`slot_name` values are acceptable depends entirely on `tracking_events` RLS policies, which are outside this report's file list (Row-Level-Security policies are covered by the parallel RLS-focused audit in this session). From this file's own code alone: no SQL injection is possible (parameterized insert via the query builder), and the worst case if RLS is permissive is low-value analytics-table pollution (fake page-view/asset-play events), not access to or modification of any other tenant's real business data.

---

## Summary of findings by severity

- Critical: 0
- High: 1 (Finding 1 — `deleteAsset` missing authorization/no-op check)
- Medium: 1 (Finding 2 — `deleteLayout` false-success no-op)
- Low: 4 (Finding 3 — Gate Desk `template_id` validation bypass; Finding 4 — missing max-length/email-format validation; Finding 5 — unvalidated `external_url` scheme; Finding 6 — raw DB error messages returned to dashboard clients)
- Info: 5 (Finding 7 — unvalidated layout JSONB shape; Finding 8 — edit page ownership check ordering; Finding 9 — accepted timing-check trade-off; Finding 10 — unbounded help-chat payload; process note — incidental `.env.local` exposure during this audit)
