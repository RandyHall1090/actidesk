# Gate Desk API Integration (T33) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `POST /api/packages` route that lets Actiforge's separate "Gate Desk" campaign backend create real packages server-to-server, bearer-token authenticated, without ever touching the HubSpot sync that dashboard-created packages get.

**Architecture:** A single new Route Handler reusing this app's existing package-creation building blocks (`slugify`/`randomSuffix`, `resolveTemplateId`) against the service-role Supabase client (`createAdminClient()`) — required because a bearer-token caller has no cookie-based session for RLS to check. The created row's `created_by` points at a real, already-created `profiles` row (a dedicated Gate Desk service account that can never actually log in). `syncPackageToHubSpot()` is never imported into this file, structurally, not just by omission-in-passing.

**Tech Stack:** Next.js Route Handler, Node's built-in `crypto.timingSafeEqual` for the bearer-token check, no new dependency.

**Spec:** `spec/plan.md`, Tech decisions (Gate Desk API bullet) + Tasks table row T33 — this plan implements that design exactly; read it alongside this plan.

## Global Constraints

- **Never import or call `syncPackageToHubSpot`** (`src/lib/hubspot.ts`) from anywhere in this task's new code — this is the one non-negotiable requirement from Actiforge's own spec for this integration. API-created packages must never generate a HubSpot contact or note.
- **`org_id` is always `SECURAFY_ORG_ID`** (`"00000000-0000-0000-0000-000000000001"`, already exported from `src/lib/hubspot.ts`) — never a request field, never client-suppliable.
- **The Gate Desk service-account profile already exists** (real infra, done this session, not a plan step): id `f97e0b1c-5b3d-4ee5-94a4-51314ceadc21`, email `gate-desk-service@securafy.com`, `org_id` = `SECURAFY_ORG_ID`, `role` = `rep`, `encrypted_password` left `NULL` (it can never actually log in — it only exists as the `created_by` foreign key this route's inserts point at). Hardcode this id as a local constant in the new route file, matching the existing `SECURAFY_ORG_ID` code-constant convention — it is not secret, just a fixed identifier.
- **`GATE_DESK_API_KEY`** (a real 64-char hex secret, already generated and given to Randy this session) must be set in `.env.local` and Vercel by Randy before this can be tested end-to-end — not something this task's implementer generates or asks the user to paste into chat. Read it via `process.env.GATE_DESK_API_KEY` at request time.
- **No DB migration needed** — `packages` already has every column this route writes (`org_id`, `created_by`, `slug`, `prospect_name`, `prospect_company`, `prospect_email`, `template_id`).
- **No test framework exists in this repo** (`CLAUDE.md`: "Test: TBD") — every step below substitutes a real, concrete curl-based verification (there's no browser UI for this route) for automated-test steps, matching every prior plan's precedent (T29-T32).

---

### Task 1: `POST /api/packages` route

**Files:**
- Create: `src/app/api/packages/route.ts`
- Modify: `src/app/(dashboard)/packages/new/actions.ts:22` (add `export` to `resolveTemplateId` — no other change to that function)

**Interfaces:**
- Consumes: `resolveTemplateId(supabase, orgId, rawTemplateId): Promise<string>` (exported by this task from `packages/new/actions.ts`); `createAdminClient()` from `src/lib/supabase/admin.ts`; `slugify`/`randomSuffix` from `src/lib/packages/slug.ts`; `SECURAFY_ORG_ID` from `src/lib/hubspot.ts`.
- Produces: `POST /api/packages` — request `{ prospect_name: string, prospect_company?: string | null, prospect_email?: string | null, template_id?: string | null }`, response `200 { slug: string, url: string }` / `400 { error: string }` / `401 { error: string }` / `500 { error: string }`.

- [ ] **Step 1: Export `resolveTemplateId`**

In `src/app/(dashboard)/packages/new/actions.ts`, change:

```ts
async function resolveTemplateId(
```

to:

```ts
export async function resolveTemplateId(
```

No other change to that function's body.

- [ ] **Step 2: Typecheck to catch a client-type mismatch early**

`resolveTemplateId`'s first parameter is currently typed `Awaited<ReturnType<typeof createClient>>` (the cookie-based server client from `@/lib/supabase/server`). This task calls it with `createAdminClient()`'s return value instead (a plain `@supabase/supabase-js` client, no cookies). Both are untyped `SupabaseClient` instances in this codebase (no generated `Database` type is used anywhere), so they're very likely structurally assignable — but verify this with the real compiler, don't assume it.

Run: `npx tsc --noEmit`
Expected (at this point, before Step 3 exists yet): clean — this step alone doesn't introduce a new call site yet, it's just confirming the baseline is clean before you add one.

- [ ] **Step 3: Write the route handler**

Create `src/app/api/packages/route.ts`:

```ts
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECURAFY_ORG_ID } from "@/lib/hubspot";
import { slugify, randomSuffix } from "@/lib/packages/slug";
import { resolveTemplateId } from "@/app/(dashboard)/packages/new/actions";

// Real profiles/auth.users row created directly this session (not by this
// code) -- can never log in (encrypted_password is NULL), exists only as
// the created_by foreign key API-created packages point at. Not secret,
// same reasoning as the SECURAFY_ORG_ID code constant it sits next to in
// spirit -- see spec/plan.md T33.
const GATE_DESK_SERVICE_PROFILE_ID = "f97e0b1c-5b3d-4ee5-94a4-51314ceadc21";

const MAX_SLUG_ATTEMPTS = 3;

function isValidBearerToken(header: string | null): boolean {
  const expected = process.env.GATE_DESK_API_KEY;
  if (!expected || !header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return timingSafeEqual(provided, expectedBuf);
}

/**
 * Server-to-server package creation for Actiforge's Gate Desk campaign
 * backend. Bearer-token authenticated (not a Supabase session -- the
 * caller is a backend, not a logged-in rep), so every DB write here goes
 * through the service-role client, same as T12's admin mutations. Never
 * calls syncPackageToHubSpot -- API-created packages must not generate a
 * HubSpot contact, only dashboard-created ones do. See spec/plan.md T33.
 */
export async function POST(req: Request) {
  if (!isValidBearerToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const prospectName = (body?.prospect_name as string | undefined)?.trim();
  if (!prospectName) {
    return NextResponse.json(
      { error: "prospect_name is required" },
      { status: 400 },
    );
  }
  const prospectCompany =
    (body?.prospect_company as string | null | undefined)?.trim() || null;
  const prospectEmail =
    (body?.prospect_email as string | null | undefined)?.trim() || null;
  const rawTemplateId =
    (body?.template_id as string | null | undefined) ?? undefined;

  const admin = createAdminClient();
  const templateId = await resolveTemplateId(
    admin,
    SECURAFY_ORG_ID,
    rawTemplateId ?? undefined,
  );

  const base = slugify(prospectName) || "package";
  let inserted: { slug: string } | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = `${base}-${randomSuffix()}`;
    const { data, error } = await admin
      .from("packages")
      .insert({
        org_id: SECURAFY_ORG_ID,
        created_by: GATE_DESK_SERVICE_PROFILE_ID,
        slug,
        prospect_name: prospectName,
        prospect_company: prospectCompany,
        prospect_email: prospectEmail,
        template_id: templateId,
      })
      .select("slug")
      .single();

    if (!error && data) {
      inserted = data;
      break;
    }
    lastError = error?.message ?? "Unknown error";
    if (error?.code !== "23505") break; // not a unique-slug collision — stop retrying
  }

  if (!inserted) {
    return NextResponse.json(
      { error: lastError ?? "Could not create package" },
      { status: 500 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return NextResponse.json({
    slug: inserted.slug,
    url: `${siteUrl}/s/${inserted.slug}`,
  });
}
```

- [ ] **Step 4: Typecheck again**

Run: `npx tsc --noEmit`
Expected: no errors. **If `resolveTemplateId`'s call in Step 3 raises a type error on the `admin` client argument:** the fix is to widen `resolveTemplateId`'s first parameter type in `packages/new/actions.ts` to a type both clients satisfy — e.g. import `SupabaseClient` from `@supabase/supabase-js` and type the parameter as `SupabaseClient` (dropping the specific `Awaited<ReturnType<typeof createClient>>` alias), since both `createClient()` (server.ts) and `createAdminClient()` (admin.ts) return instances of that same underlying class. Re-run `npx tsc --noEmit` after making that change and confirm it's clean everywhere (`packages/new/actions.ts`'s own existing call site included, not just the new route).

- [ ] **Step 5: Real manual verification — auth gate**

Run: `npm run dev` (background).

Confirm `GATE_DESK_API_KEY` is actually set for the running dev server first: if `npm run dev` was already running before this key was added to `.env.local`, restart it so the new env var is picked up.

No auth header:
```
curl -i -X POST http://localhost:3000/api/packages -H "Content-Type: application/json" -d "{\"prospect_name\":\"Test\"}"
```
Expected: `HTTP/1.1 401`.

Wrong token:
```
curl -i -X POST http://localhost:3000/api/packages -H "Authorization: Bearer wrong-token" -H "Content-Type: application/json" -d "{\"prospect_name\":\"Test\"}"
```
Expected: `HTTP/1.1 401`.

- [ ] **Step 6: Real manual verification — validation and success**

Get the real key value from the local environment without echoing it into chat — e.g. read it via a short script/command that uses it directly rather than printing it (for example, in the same terminal session where the dev server's env is loaded, reference `$env:GATE_DESK_API_KEY` / `process.env.GATE_DESK_API_KEY` directly in the curl invocation rather than typing the literal secret value anywhere in your report).

Blank prospect_name, valid token:
```
curl -i -X POST http://localhost:3000/api/packages -H "Authorization: Bearer $GATE_DESK_API_KEY" -H "Content-Type: application/json" -d "{\"prospect_name\":\"\"}"
```
Expected: `HTTP/1.1 400`.

Real request, valid token:
```
curl -i -X POST http://localhost:3000/api/packages -H "Authorization: Bearer $GATE_DESK_API_KEY" -H "Content-Type: application/json" -d "{\"prospect_name\":\"Gate Desk Test Prospect\",\"prospect_company\":\"Test Co\",\"prospect_email\":\"test@example.com\"}"
```
Expected: `HTTP/1.1 200` with a real JSON body `{"slug":"...","url":"http://localhost:3000/s/..."}` (the `url` will show `NEXT_PUBLIC_SITE_URL`'s locally-configured value, not necessarily the production domain — that's expected for a local run).

- [ ] **Step 7: Verify the database side directly**

Using `mcp__supabase__execute_sql` (project_id `fywmrqbxjlocjsdopjep`), confirm the row this created:

```sql
select id, org_id, created_by, slug, prospect_name, prospect_company, prospect_email, template_id, created_at
from public.packages
where slug = '<the real slug from Step 6''s response>';
```

Expected: one row, `org_id` = `00000000-0000-0000-0000-000000000001`, `created_by` = `f97e0b1c-5b3d-4ee5-94a4-51314ceadc21`, `prospect_name`/`prospect_company`/`prospect_email` matching what was sent.

Then confirm no HubSpot side effect happened — check the actual server logs from the `npm run dev` process for this request (`syncPackageToHubSpot` logs its own errors to the console if it ever runs; its complete absence from the logs for this request, combined with the fact this route's code never imports it, is the confirmation). Do not call any real HubSpot API to check — the absence of the import in the diff plus a clean log is sufficient and doesn't risk creating a real contact if something were wrong.

Delete the test package afterward:
```sql
delete from public.packages where slug = '<the real slug>';
```

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/packages/route.ts" "src/app/(dashboard)/packages/new/actions.ts"
git commit -m "feat: Gate Desk server-to-server package creation (T33)"
```
