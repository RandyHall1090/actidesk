-- A rep's default preset ("Start from a template"): new packages -- in the
-- web New Package form and the Outlook add-in -- start pre-filled from it.
-- Deleting the preset clears the default. Set only through server code that
-- checks the rep may use the preset (src/lib/packages/defaultPreset.ts).
alter table public.profiles
  add column default_preset_id uuid references public.presets(id) on delete set null;
