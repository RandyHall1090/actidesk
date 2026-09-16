# Security Audit — Multi-Tenant RLS & Database-Layer Authorization

Scope: all 23 migrations (`0001_initial_schema.sql` → `0023_packages_delete_own_or_admin.sql`), reconstructed final state, cross-checked against the live database (`fywmrqbxjlocjsdopjep`) via `pg_policies`, `pg_tables`, `pg_proc`, and the Supabase security advisor. Read-only — no writes were made to the database or repo.

**Live database matched the migration-file-reconstructed final state exactly** for every policy and every `SECURITY DEFINER` function inspected. No out-of-band/manual database change was detected.

---

## Finding 1 — CRITICAL: INSERT policies on `assets`, `packages`, `presets` do not validate `org_id`, allowing cross-tenant row injection

**Severity**: Critical

**Table/Policy**: `public.assets` → `assets_insert_own`; `public.packages` → `packages_insert_own`; `public.presets` → `presets_insert_own`

**Description**

Each of these `WITH CHECK` clauses validates only ownership, never tenancy:

```sql
-- assets  (0001, unchanged through 0023)
create policy "assets_insert_own" on public.assets
  for insert with check (owner_id = auth.uid());

-- packages (0001, unchanged through 0023)
create policy "packages_insert_own" on public.packages
  for insert with check (created_by = auth.uid());

-- presets  (0019, unchanged through 0023)
create policy "presets_insert_own" on public.presets
  for insert with check (created_by = auth.uid());
```

None of these check that the `org_id` column on the new row equals the caller's own `org_id` (from their `profiles` row). Live `pg_policies` confirms this is exactly what's deployed today: `with_check` for all three is a bare `(owner_id = auth.uid())` / `(created_by = auth.uid())` — no `org_id` term at all. Compare this with `layouts_insert_admin`, which is correctly parameterized: `with check (is_org_admin(org_id))` — `is_org_admin` takes the *target* `org_id` as an argument and checks the caller is an admin *of that specific org*, so a caller can never insert a `layouts` row for an org they don't belong to. `assets`/`packages`/`presets` have no equivalent guard.

This is precisely the gap the audit brief's checklist item 5 anticipated ("a rep cannot INSERT a row with an org_id different from their own") and the caveat under item 1 ("a created_by-only check is fine ONLY if created_by rows can only ever exist within the caller's own org, which itself depends on INSERT policies being correctly scoped") — that precondition is false here.

Any authenticated user (rep or admin, any org) can `INSERT` directly against PostgREST (`/rest/v1/assets`, `/rest/v1/packages`, `/rest/v1/presets`) with their own JWT, setting `org_id` to **any other tenant's org id**, and the `WITH CHECK` will pass as long as `owner_id`/`created_by` is their own uid.

**Exploit scenario**

1. Attacker is a legitimate rep in Org A (`org_id = A`), knows or guesses Org B's `org_id` (org ids are not secret — they're returned by `orgs_select_member`/`find_org_by_email_domain`, or simply the seeded default `00000000-0000-0000-0000-000000000001` for Securafy itself).
2. Attacker calls `POST /rest/v1/assets` with their own access token: `{"org_id": "<Org B id>", "owner_id": "<attacker uid>", "scope": "company", "kind": "video", "name": "Q3 Onboarding Video", "external_url": "https://attacker-controlled.example/video"}`. `assets_insert_own`'s `WITH CHECK` passes (`owner_id = auth.uid()` is true); no org check exists to stop it.
3. Every member of Org B now sees this row via `assets_select_org` (`p.org_id = assets.org_id` matches for real Org B members, and `scope = 'company'`), so it appears as a normal shared/company asset in Org B's library. Because it uses `external_url` (not `storage_path`), it is **not** gated by any Storage RLS check — it plays immediately for any Org B rep who opens it, and can be attached to a real Org B package.
4. Identically, the attacker can `POST /rest/v1/packages` with `org_id = <Org B id>`, `created_by = <attacker uid>`, an attacker-chosen `slug`, `prospect_name`, `letter_body`, etc. `packages_insert_own`'s `WITH CHECK` passes the same way. This row is now visible to every Org B member via `packages_select_org`, and reachable by anyone at the **public, unauthenticated** `/s/<slug>` page — `get_package_by_slug` joins `orgs` on the package's `org_id`, so the page renders with **Org B's real name and real logo** (`org_logo_storage_path` pulled from Org B's own logo asset) while every other field (letter text, prospect name/company, and — via `package_assets`/`get_package_assets_by_slug` — attached video/image content) is fully attacker-controlled.
5. The attacker can further `INSERT` into `package_assets` for that package (`package_assets_write`'s `USING`/default `WITH CHECK` only requires `pk.created_by = auth.uid()`, which is true since the attacker created the spoofed package), attaching their poisoned assets to it.

Net effect: an authenticated user in *any* tenant (including a low-trust/free-trial org, if the product ever adds one) can fabricate a fully working, Org-B-branded phishing page at a real `/s/<slug>` URL, or silently plant a malicious "company" video/asset into another tenant's shared library — a complete tenant-isolation bypass via the write path, not just a read leak.

**Recommendation**

Add an explicit tenancy check to every affected `WITH CHECK`, mirroring the `is_org_admin(org_id)` pattern already used correctly by `layouts`:

```sql
create policy "assets_insert_own" on public.assets
  for insert with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = assets.org_id)
  );

create policy "packages_insert_own" on public.packages
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = packages.org_id)
  );

create policy "presets_insert_own" on public.presets
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = presets.org_id)
  );
```

(Equivalent to requiring `org_id = (select org_id from public.profiles where id = auth.uid())`.) This closes the write-path hole without touching any SELECT/read behavior.

---

## Finding 2 — CRITICAL: UPDATE policies on `assets`, `packages`, `presets` have no `WITH CHECK`, so the owner-only `USING` clause silently doubles as the write-check and never re-validates `org_id`

**Severity**: Critical

**Table/Policy**: `public.assets` → `assets_update_own_or_admin`; `public.packages` → `packages_update_own`; `public.presets` → `presets_update_own_or_admin`

**Description**

```sql
-- live pg_policies, all three UPDATE policies have with_check = null
assets_update_own_or_admin:   qual = (owner_id = auth.uid()) OR is_org_admin(org_id)
packages_update_own:          qual = (created_by = auth.uid())
presets_update_own_or_admin:  qual = (created_by = auth.uid()) OR is_org_admin(org_id)
```

Per Postgres RLS semantics, when an `UPDATE` policy defines only `USING` and no `WITH CHECK`, Postgres uses the `USING` expression for the `WITH CHECK` as well — evaluated against the **new** row. Because the owner branch of each of these (`owner_id = auth.uid()` / `created_by = auth.uid()`) does not reference `org_id` at all, it evaluates to `true` for the new row regardless of what the caller sets `org_id` to, as long as they still own the row. This means the row's **original owner can freely reassign `org_id` (and, for assets, `scope`) to any other tenant via a plain `PATCH`**, with no admin privilege needed.

This is a second, independent path to the same outcome as Finding 1, and it is not mitigated by fixing Finding 1 alone — Finding 1 stops a *new* cross-tenant row from being created, but Finding 2 lets an attacker legitimately create a row in their **own** org first (satisfying a fixed Finding 1), then relabel it into a victim org after the fact.

Contrast with `layouts_update_admin` (`using (is_org_admin(org_id))`, `with_check` also defaults to the same expression) — there, the defaulted `WITH CHECK` re-evaluates `is_org_admin(new.org_id)`, which is false unless the caller is actually an admin of the *target* org, so `layouts` cannot be reassigned cross-tenant. `profiles` is protected by an entirely separate mechanism (the `prevent_self_role_escalation` trigger explicitly raises on any `org_id` change, for non-`service_role` callers) — `assets`, `packages`, and `presets` have no equivalent trigger and no equivalent parameterized check.

**Exploit scenario**

1. Attacker is a legitimate rep in Org A, owns a real `assets` row (`owner_id = self`, `org_id = A`, `scope = 'personal'`).
2. Attacker calls `PATCH /rest/v1/assets?id=eq.<asset id>` with `{"org_id": "<Org B id>", "scope": "company"}`. `assets_update_own_or_admin`'s `USING` (old row: `owner_id = auth.uid()`, true) permits the row to be targeted; the defaulted `WITH CHECK` (new row: `owner_id = auth.uid()`, still true since `owner_id` wasn't touched) permits the write. The row now has `org_id = B`, `scope = 'company'`.
3. Every Org B member now sees this attacker-owned, attacker-controlled asset via `assets_select_org`. If it's an `external_url` (video/audio) asset, it plays with no Storage RLS involved at all.
4. Identically, a rep can `PATCH` a `packages` row they created, changing `org_id` to any other tenant after the fact — the package (and its `/s/<slug>` public page, letter body, attached assets) becomes attributed to and branded as the victim org, exactly as in Finding 1's exploit chain.

**Recommendation**

Add an explicit `WITH CHECK` to each of these three UPDATE policies that pins `org_id` to be unchanged (cheapest, matches the `profiles`/`prevent_self_role_escalation` precedent) — either via a trigger identical in spirit to `prevent_self_role_escalation` (raise on `new.org_id is distinct from old.org_id` unless `auth.role() = 'service_role'`), or directly in the policy:

```sql
create policy "assets_update_own_or_admin" on public.assets
  for update using (
    owner_id = auth.uid() or public.is_org_admin(org_id)
  )
  with check (
    org_id = (select p.org_id from public.profiles p where p.id = auth.uid())
    or public.is_org_admin(org_id)
  );
```

A trigger-based fix is preferable for consistency with the existing `profiles` precedent and because it also protects any future policy added to these tables.

---

## Finding 3 — Info: `orgs_insert_self` allows any authenticated user to directly create `orgs` rows, bypassing `complete_signup`'s domain-collision check

**Severity**: Info

**Table/Policy**: `public.orgs` → `orgs_insert_self` (`with check (created_by = auth.uid())`)

**Description**: `complete_signup()` is the intended, atomic create-or-join path and independently re-checks "does an org already exist for this email domain" before inserting. But `orgs_insert_self` itself has no such check — any authenticated user can `POST /rest/v1/orgs` directly with an arbitrary `name`/`email_domain` (`created_by` forced to their own uid). The DB-level `unique (email_domain)` constraint still prevents hijacking an *existing* domain, and a freshly-created stray org has no `profiles` rows pointing at it (membership is only ever granted through `complete_signup`/admin actions), so this does not grant access to any other tenant's data — it only lets a user litter the `orgs` table with empty, orphaned org rows. Not a tenant-isolation issue; flagged for completeness only. No action required unless orphaned-org hygiene becomes a concern (e.g., restrict this policy's `WITH CHECK` to also require the domain not already exist, matching `complete_signup`'s own check).

## Finding 4 — Info: Several `SECURITY DEFINER` helper functions are directly RPC-callable by `anon`/`authenticated` (flagged by Supabase's own linter)

**Severity**: Info

**Function**: `is_org_admin`, `is_platform_admin`, `find_org_by_email_domain`, `get_layout_by_id`, `get_package_by_slug`, `get_package_assets_by_slug`, `asset_public_via_package`, `asset_public_company_logo`, `complete_signup`

**Description**: The Supabase security advisor flags all of these as "Public/Signed-in users can execute SECURITY DEFINER function" because Postgres/PostgREST exposes every `public`-schema function as an RPC endpoint by default. In every case this is the **deliberate, documented design** already reasoned about in the migrations (0004, 0005, 0010, 0015, 0016–0018): each function either (a) is intentionally public-safe because it takes a specific, unguessable identifier and returns at most one narrow row (`get_package_by_slug`, `get_package_assets_by_slug`, `get_layout_by_id`, `asset_public_via_package`, `asset_public_company_logo`), or (b) is safe for `anon` specifically because `auth.uid()` is `null` under the anon role, so the underlying `EXISTS` check can never match (`is_org_admin`, `is_platform_admin`), or (c) enforces its own internal authorization (`complete_signup` checks `auth.uid()` is non-null and rejects a second profile). `find_org_by_email_domain` does deliberately leak org *existence and name* for a guessed email domain — a minor, by-design information disclosure used for the "join an existing company" signup UX; it does not expose membership, packages, or any other tenant data. No changes recommended; documenting per the advisor result.

## Finding 5 — Info: `tracking_events_insert_public` is wide open (`with check (true)`) — by design

**Severity**: Info

**Table/Policy**: `public.tracking_events` → `tracking_events_insert_public`

**Description**: Any caller (including fully unauthenticated `anon`) can `INSERT` a `tracking_events` row for any `package_id`, since the public `/s/[slug]` page (the prospect's own browser) must be able to record page-view/asset-opened events without a session. This is explicitly called out as intentional in the 0001 migration comment. The blast radius is limited to needing a real, existing `package_id` (enforced by the FK to `packages(id) on delete cascade`, and in practice only ever learned by whoever holds a package's `/s/<slug>` link) and is limited to forging analytics noise (fake `page_view`/`asset_opened` rows) — it cannot read or write anything else. `tracking_events_select_org` correctly restricts reads to the package's own org. No change recommended.

---

## Verified NOT vulnerable

- **`is_org_admin(check_org_id)`** — correctly parameterized: `role = 'admin' and org_id = check_org_id and id = auth.uid()`. It checks admin status *of the specific target org*, not "is this user an admin of any org" — confirmed identical between migration 0005 (initial), and the live `pg_proc` definition (unchanged since).
- **`profiles` RLS (the 0005 recursion fix)** — `profiles_select_own_or_admin` (`id = auth.uid() or is_org_admin(org_id) or is_platform_admin()`), `profiles_update_own` (`id = auth.uid()`), `profiles_update_admin` (`is_org_admin(org_id)`). No infinite recursion (the admin check goes through the `SECURITY DEFINER` `is_org_admin`, which bypasses `profiles`' own RLS as the function owner), and no "allow all authenticated" fallback was introduced at any point in the migration history or in the live policy set. `org_id`, `role`, and `is_platform_admin` changes are further hard-blocked by the `prevent_self_role_escalation` trigger for any non-`service_role` caller, independent of RLS.
- **`get_package_by_slug` / `get_package_assets_by_slug`** (the public `/s/[slug]` RPCs) — confirmed the live function bodies return only `id, slug, prospect_name, prospect_company, letter_body, template_id, org_name, org_logo_storage_path, calendar_url` (package) and `slot_name, kind, name, storage_path, external_url` (assets), each scoped to exactly the one package matching the given slug (`limit 1` / join on `pk.slug = p_slug`). Neither leaks raw `org_id`, `private_note`, `prospect_email`, or any other package's/org's data. No blanket anon `SELECT` policy exists on `packages`, `package_assets`, or `assets` — every anon-readable fact goes through one of these narrow, single-row `SECURITY DEFINER` functions, exactly as the 0004 migration's own design note describes.
- **Storage bucket signing (0016/0017/0018 root-cause fix)** — confirmed intact and not regressed by any later migration (0019–0023 touch none of `storage.objects`). Live `storage.objects` policies: `assets_storage_select_org`/`assets_storage_insert_own`/`assets_storage_delete_own_or_admin` (authenticated, scoped to the caller's own real `org_id` looked up server-side from `profiles`, never from a client-supplied parameter) and the anon-facing `assets_storage_select_public_via_package`/`assets_storage_select_public_logo`, which delegate to the `SECURITY DEFINER` boolean functions `asset_public_via_package`/`asset_public_company_logo` — both confirmed to require a real, exact, unguessable `storage_path` already attached to a package or already tagged as a company logo; there is no enumeration primitive. `assets_storage_insert_own`'s `WITH CHECK` derives the required org-folder segment from the caller's own `profiles.org_id` via subquery (not from the request), so a caller cannot write into another tenant's storage folder regardless of what `org_id` they claim elsewhere.
- **`layouts`** — `layouts_insert_admin`/`layouts_update_admin`/`layouts_delete_admin` all correctly use `is_org_admin(org_id)` (parameterized to the row's own `org_id`) in a way that also protects `UPDATE`'s defaulted `WITH CHECK` (re-validates the *new* `org_id` too) — this table does **not** share Finding 1/2's vulnerability pattern.
- **`orgs`** — `orgs_select_member` (own org, or platform admin), `orgs_update_admin` (`is_org_admin(id)`, correctly parameterized) are properly scoped. (`orgs_insert_self` — see Finding 3, Info only, not a cross-tenant data exposure.)
- **`package_assets` / `preset_assets`** — `SELECT` policies correctly join back to the parent `packages`/`presets` row and require the caller's real profile `org_id` to match (or platform admin); the `ALL` write policies correctly require the caller to be the parent row's owner or org admin (their exposure to cross-tenant abuse is entirely inherited from Finding 1/2 on the *parent* tables, not an independent bug in `package_assets`/`preset_assets` themselves).
- **RLS actually enabled**: live `pg_tables.rowsecurity = true` confirmed for every tenant-scoped table: `assets`, `layouts`, `orgs`, `package_assets`, `packages`, `preset_assets`, `presets`, `profiles`, `tracking_events`. No table has policies defined but RLS disabled.
- **Live vs. migration-file match**: the live `pg_policies`, `pg_tables.rowsecurity`, and every `SECURITY DEFINER` function's `pg_get_functiondef()` output were byte-for-byte consistent with the state reconstructed by reading all 23 migrations in order. **No mismatch was found** — there is no evidence of an out-of-band/manual change made directly against the database outside the migration history.

---

## Summary of findings by severity

| Severity | Count | Titles |
|---|---|---|
| Critical | 2 | INSERT policies missing `org_id` check (Finding 1); UPDATE policies missing `org_id` re-check via defaulted `WITH CHECK` (Finding 2) |
| High | 0 | — |
| Medium | 0 | — |
| Low | 0 | — |
| Info | 3 | `orgs_insert_self` orphan-org creation (Finding 3); anon-callable `SECURITY DEFINER` helpers, by design (Finding 4); open `tracking_events` insert, by design (Finding 5) |
