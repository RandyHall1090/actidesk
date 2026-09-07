-- Storage bucket for image/document/business-card/logo assets.
-- Video/audio don't use this — they're Vimeo links (external_url on the
-- assets table), not stored here. Path convention enforced by the RLS
-- policies below: {org_id}/{scope}/{owner_id}/{filename}

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

create policy "assets_storage_select_org"
on storage.objects for select
to authenticated
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = (
    select org_id::text from public.profiles where id = auth.uid()
  )
);

create policy "assets_storage_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = (
    select org_id::text from public.profiles where id = auth.uid()
  )
  and (storage.foldername(name))[3] = auth.uid()::text
);

create policy "assets_storage_delete_own_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'assets'
  and (
    (storage.foldername(name))[3] = auth.uid()::text
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.org_id::text = (storage.foldername(name))[1]
    )
  )
);
