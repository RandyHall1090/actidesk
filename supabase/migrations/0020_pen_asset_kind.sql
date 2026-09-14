-- New optional desk-scene prop: a pen resting on the desk. Modeled exactly
-- like every other content slot (an asset a rep picks or leaves blank, not
-- a special-cased boolean flag) so "show/hide per package" falls out of the
-- existing optional-slot mechanism for free, and any tenant can upload
-- their own pen photo rather than being stuck with one baked-in image.
alter table public.assets drop constraint assets_kind_check;
alter table public.assets add constraint assets_kind_check
  check (kind = any (array['video', 'audio', 'image', 'document', 'business_card', 'logo', 'pen']));
