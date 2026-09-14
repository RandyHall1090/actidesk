-- Templates (presets) were entirely admin-authored, org-wide, no owner
-- concept -- see 0013's own comment. Randy asked for any rep to be able to
-- create a template, share it with the team, and for other reps to clone a
-- shared one into their own editable copy. This adds the same
-- personal/company scope concept `assets` already has (0001), reusing the
-- existing `created_by` column as the ownership column rather than adding
-- a redundant one.
--
-- Deliberate departure from the assets convention: for assets, only an org
-- admin can mark something "company" scope (LibraryClient.tsx disables
-- that option for non-admins) -- Randy explicitly asked for any rep to be
-- able to share their own template themselves, not just admins, so that
-- restriction is NOT carried over here.
alter table public.presets
  add column scope text not null default 'personal'
    check (scope in ('personal', 'company'));

-- Every existing preset was created under the old admin-only, org-wide
-- model -- backfill as 'company' so they don't suddenly vanish from every
-- rep's "Start from a template" picker on the New Package form.
update public.presets set scope = 'company';

drop policy "presets_select_org" on public.presets;
create policy "presets_select_org" on public.presets
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.org_id = presets.org_id
    )
    and (scope = 'company' or created_by = auth.uid())
  );

drop policy "presets_insert_admin" on public.presets;
create policy "presets_insert_own" on public.presets
  for insert with check (created_by = auth.uid());

drop policy "presets_update_admin" on public.presets;
create policy "presets_update_own_or_admin" on public.presets
  for update using (
    created_by = auth.uid() or public.is_org_admin(org_id)
  );

drop policy "presets_delete_admin" on public.presets;
create policy "presets_delete_own_or_admin" on public.presets
  for delete using (
    created_by = auth.uid() or public.is_org_admin(org_id)
  );

-- preset_assets follows the parent preset's permissions (0013's own
-- pattern) -- both policies need the same scope/ownership awareness the
-- parent table just gained, or a personal preset's slot picks would still
-- leak to (select) or be writable by (write) every org member regardless
-- of the new scope column.
drop policy "preset_assets_select" on public.preset_assets;
create policy "preset_assets_select" on public.preset_assets
  for select using (
    exists (
      select 1 from public.presets pr
      join public.profiles p on p.org_id = pr.org_id
      where pr.id = preset_assets.preset_id
        and p.id = auth.uid()
        and (pr.scope = 'company' or pr.created_by = auth.uid())
    )
  );

drop policy "preset_assets_write" on public.preset_assets;
create policy "preset_assets_write" on public.preset_assets
  for all using (
    exists (
      select 1 from public.presets pr
      where pr.id = preset_assets.preset_id
        and (pr.created_by = auth.uid() or public.is_org_admin(pr.org_id))
    )
  );
