-- orgs.created_by had no ON DELETE action, so deleting the user who created
-- an org (every org's founding admin) failed with a foreign-key violation
-- and ActiDesk's admin "Delete user" couldn't remove them. The column is
-- informational only, so the org simply forgets its creator.
alter table public.orgs
  drop constraint orgs_created_by_fkey,
  add constraint orgs_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
