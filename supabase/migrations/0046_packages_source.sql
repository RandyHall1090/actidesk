-- Where a package was created, so usage of each entry point (web form,
-- Outlook panel, List Merge, email signature, server API, automatic
-- follow-up) can be measured. Rows created before this column existed stay
-- null: their origin was never recorded and can't be recovered.
alter table public.packages
  add column source text
    check (source in ('web', 'outlook', 'list_merge', 'signature', 'api', 'follow_through'));
