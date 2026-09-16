# Meeting-Scheduling CTA (T32) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Below the desk-scene hero on the public `/s/[slug]` page, show a "Schedule a meeting" button linking to the *creating rep's own* scheduling URL — set once by that rep on `/account`, not one shared org-wide link.

**Architecture:** A new nullable `profiles.calendar_url` column, editable by a rep on their own `/account` page via a new server action (mirroring the existing `setProfileRole`/`ChangePasswordForm` patterns already in this app). The public page's existing `get_package_by_slug` SECURITY DEFINER RPC gets one more joined column (via `packages.created_by → profiles.id`, a link that already exists) so the public page can render the button without any new access-control surface — same "branding, not secret" reasoning already used for the org logo and HubSpot Contact-record data.

**Tech Stack:** Supabase Postgres migration (SQL), Next.js Server Action, no new dependency.

**Spec:** `spec/plan.md`, Tech decisions (meeting-scheduling CTA bullet) + Tasks table row T32 — this plan implements that design exactly; read it alongside this plan.

## Global Constraints

- **The migration is a real write to the live `shock-and-awe` Supabase project** (ref `fywmrqbxjlocjsdopjep`) via `mcp__supabase__apply_migration` — this repo's documented workflow (`supabase/README.md`). Per this repo's standing rule (every DB write/install this session has needed it), **get Randy's explicit approval before running either migration** — don't just run it because it's written as a step here.
- **A rep's scheduling URL is their own personal link, not an org-wide one.** The public page must show the URL belonging to the specific rep who created that package (`packages.created_by`), never an org-level fallback.
- **Plain URL, no Calendly-specific integration** — must accept any `http://`/`https://` URL (Calendly, Cal.com, HubSpot Meetings, anything). Empty clears it back to `null`.
- **The CTA must not render at all when the creating rep has no `calendar_url` set** — same conditional-render pattern this page already uses for the org logo (`{orgLogoUrl && (...)}`).
- **No test framework exists in this repo** (`CLAUDE.md`: "Test: TBD") — every step below substitutes a real, concrete manual/CLI verification for automated-test steps, matching every prior plan's precedent (T29-T31).
- **Test account for manual verification:** `claude-dev@securafy.com` / `T30VerifyTemp-9f2c!` (a shared dev/test account for this pre-production app, still valid as of this session).

---

### Task 1: `profiles.calendar_url` column + rep self-service form on `/account`

**Files:**
- Create: `supabase/migrations/0021_rep_calendar_url.sql`
- Modify: `src/lib/profile.ts`
- Create: `src/app/(dashboard)/account/actions.ts`
- Create: `src/app/(dashboard)/account/CalendarLinkForm.tsx`
- Modify: `src/app/(dashboard)/account/page.tsx`

**Interfaces:**
- Produces: `Profile.calendar_url: string | null` (from `src/lib/profile.ts`'s `getCurrentProfile()`); `updateCalendarUrl(url: string): Promise<{ ok: boolean; error?: string }>` server action, consumed by `CalendarLinkForm`. Task 2 does NOT depend on this task's interfaces (it reads the column directly via SQL), but both tasks touch the same underlying column, so this task must land first.

- [ ] **Step 1: Get Randy's explicit go-ahead for the migration, then write and apply it**

Ask Randy directly: "OK to add a nullable `calendar_url` column to `profiles` on the live `shock-and-awe` Supabase project (ref `fywmrqbxjlocjsdopjep`)? Purely additive, no data loss, easy to `drop column` if needed." Wait for an explicit yes before proceeding.

Create `supabase/migrations/0021_rep_calendar_url.sql`:

```sql
-- A rep's own meeting-scheduling link (Calendly, Cal.com, HubSpot Meetings,
-- or anything else) -- shown as a CTA on packages that rep creates. Plain
-- rep-entered URL, not a provider-specific integration, since this app is
-- multi-tenant and no single connected scheduling account would generalize
-- across every tenant's reps. See spec/plan.md T32.
alter table public.profiles add column if not exists calendar_url text;
```

Apply it with `mcp__supabase__apply_migration` (project_id `fywmrqbxjlocjsdopjep`), passing the file's content as the migration SQL and `0021_rep_calendar_url` as the migration name.

Expected: the tool reports success; the column exists on the live table.

- [ ] **Step 2: Extend `Profile` and `getCurrentProfile()`**

In `src/lib/profile.ts`, add `calendar_url: string | null;` to the `Profile` type (after `is_platform_admin`), and add `calendar_url` to the `.select(...)` column list inside `getCurrentProfile()`:

```ts
export type Profile = {
  id: string;
  org_id: string;
  role: "rep" | "admin";
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  calendar_url: string | null;
};

/** The signed-in user's profile row, or null if not signed in. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, org_id, role, full_name, email, is_active, is_platform_admin, calendar_url",
    )
    .eq("id", user.id)
    .single();

  return profile;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this touches a type used broadly, so a clean pass here is meaningful — it means no existing caller destructures a field name that collides or breaks).

- [ ] **Step 4: Write the server action**

Create `src/app/(dashboard)/account/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

/**
 * Authorization is enforced by the database, same reasoning as
 * setProfileRole in team/actions.ts: profiles_update_own already lets a
 * rep update any column on their own row except role/org_id (guarded by
 * the prevent_self_role_escalation trigger), so no extra permission check
 * is needed here beyond scoping the update to the caller's own id.
 */
export async function updateCalendarUrl(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      error: "Must be a full URL starting with http:// or https://",
    };
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Not signed in." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ calendar_url: trimmed || null })
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/account");
  return { ok: true };
}
```

- [ ] **Step 5: Write the form component**

Create `src/app/(dashboard)/account/CalendarLinkForm.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { updateCalendarUrl } from "./actions";

export function CalendarLinkForm({
  initialUrl,
}: {
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStatus("sending");
    const result = await updateCalendarUrl(url);
    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.error ?? "Something went wrong.");
      return;
    }
    setStatus("done");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4"
    >
      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Scheduling link
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Shown as a &quot;Schedule a meeting&quot; button on every package page
        you send. Paste your Calendly, Cal.com, or other booking link.
      </p>
      <input
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://calendly.com/your-name"
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-neutral-500 dark:border-neutral-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 transition-opacity disabled:opacity-50"
      >
        {status === "sending" ? "Saving…" : "Save"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 6: Mount it on the account page**

In `src/app/(dashboard)/account/page.tsx`, import `CalendarLinkForm` from `./CalendarLinkForm` and render `<CalendarLinkForm initialUrl={profile.calendar_url} />` directly after `<ChangePasswordForm />`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Real manual verification**

Run: `npm run dev`. Sign in as `claude-dev@securafy.com` / `T30VerifyTemp-9f2c!`. Go to `/account`. Enter `not-a-url` and Save — confirm the inline error appears and nothing is saved. Enter a real-looking URL, e.g. `https://calendly.com/test-rep/30min`, and Save — confirm "Saved." appears. Reload the page — confirm the field still shows that URL (proves it persisted, not just client state). Clear the field and Save — confirm it saves empty (clears back to null).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0021_rep_calendar_url.sql src/lib/profile.ts "src/app/(dashboard)/account/actions.ts" "src/app/(dashboard)/account/CalendarLinkForm.tsx" "src/app/(dashboard)/account/page.tsx"
git commit -m "feat: rep-editable scheduling link on /account (T32)"
```

---

### Task 2: Public-page CTA

**Files:**
- Create: `supabase/migrations/0022_package_lookup_calendar_url.sql`
- Modify: `src/app/s/[slug]/page.tsx`
- Modify: `src/app/s/[slug]/PackageView.tsx`

**Interfaces:**
- Consumes: `profiles.calendar_url` (Task 1's column — this task reads it directly via SQL join, not through any of Task 1's TypeScript interfaces).
- Produces: `PackageView`'s new `calendarUrl: string | null` prop.

- [ ] **Step 1: Get Randy's explicit go-ahead, then write and apply the RPC migration**

Ask Randy directly: "OK to update `get_package_by_slug` (the public package-page lookup function) on the live project to also return the creating rep's `calendar_url`? Read-only addition, no data changes." Wait for an explicit yes.

Create `supabase/migrations/0022_package_lookup_calendar_url.sql`:

```sql
-- Return type is changing (new output column), so this needs a drop first --
-- CREATE OR REPLACE can't alter an existing function's OUT column list.
-- (Same pattern as 0012_package_lookup_org_branding.sql.)
drop function if exists public.get_package_by_slug(text);

create function public.get_package_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  prospect_name text,
  prospect_company text,
  letter_body text,
  template_id text,
  org_name text,
  org_logo_storage_path text,
  calendar_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.slug, p.prospect_name, p.prospect_company, p.letter_body, p.template_id,
    o.name as org_name,
    (
      select a.storage_path from public.assets a
      where a.org_id = p.org_id and a.kind = 'logo' and a.scope = 'company'
      order by a.created_at desc
      limit 1
    ) as org_logo_storage_path,
    rep.calendar_url
  from public.packages p
  join public.orgs o on o.id = p.org_id
  join public.profiles rep on rep.id = p.created_by
  where p.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_package_by_slug(text) to anon, authenticated;
```

Apply it with `mcp__supabase__apply_migration` (project_id `fywmrqbxjlocjsdopjep`), migration name `0022_package_lookup_calendar_url`.

Expected: success. Verify directly: `select pg_get_functiondef(oid) from pg_proc where proname = 'get_package_by_slug';` via `mcp__supabase__execute_sql` should show the new `calendar_url` output column and the `join public.profiles rep` line.

- [ ] **Step 2: Wire `page.tsx`**

In `src/app/s/[slug]/page.tsx`, add `calendar_url: string | null;` to the `PackageRow` type (after `org_logo_storage_path`), and pass `calendarUrl={pkg.calendar_url}` as a new prop on the `<PackageView>` element (alongside the existing `orgLogoUrl` prop).

- [ ] **Step 3: Add the prop and render the CTA in `PackageView.tsx`**

Add `calendarUrl: string | null;` to `PackageView`'s props type (after `orgLogoUrl`) and destructure it in the function signature.

Insert the CTA immediately after the `<DeskScene ... />` wrapper `</div>` (the `<div className="mb-8">` that wraps `<DeskScene>`) and before the `<div className="mx-auto max-w-3xl">` letter/documents section:

```tsx
{calendarUrl && (
  <div className="mb-8 text-center">
    <a
      href={calendarUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Schedule a meeting
    </a>
  </div>
)}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Real manual verification, both states**

Run: `npm run dev`. Using the account you set a scheduling link on in Task 1 (`claude-dev@securafy.com`), create a real test package (via `/packages/new`) and open its real public `/s/[slug]` link — confirm the "Schedule a meeting" button appears directly below the desk scene, and clicking it opens the scheduling URL in a new tab. Then clear that rep's `calendar_url` on `/account` (Task 1's form), reload the same package's public page, and confirm the button is now completely absent (not just hidden/disabled) — no leftover empty space either. Restore the test URL afterward so the account is left in a sensible state. Delete the test package through the dashboard's own delete/cleanup path if one exists, or note in your report if it doesn't and the package was left in place.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0022_package_lookup_calendar_url.sql "src/app/s/[slug]/page.tsx" "src/app/s/[slug]/PackageView.tsx"
git commit -m "feat: meeting-scheduling CTA on public package page (T32)"
```
