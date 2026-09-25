-- Each rep can have one email-signature package: a generic package whose
-- desk screenshot, linked to the package, goes in their email signature.
-- signature_image_url is the public URL of that screenshot.
alter table public.profiles
  add column signature_package_id uuid references public.packages(id) on delete set null,
  add column signature_image_url text;

-- Public read: email clients fetch the image with no credentials. No
-- storage.objects policies are added, so only the service role (the
-- server-side signature code) can write to it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signature-images', 'signature-images', true, 1048576, array['image/jpeg']);
