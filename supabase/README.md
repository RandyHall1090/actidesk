# supabase/

`migrations/` contains every SQL migration applied to the live `actidesk`
Supabase project (ref `fywmrqbxjlocjsdopjep`, Securafy org, `us-east-1`), in
order. This directory is the source of truth for what the schema *should* be —
if you change the live project directly in the Supabase dashboard, add a
matching numbered file here too, or the two will drift.

Applying a new migration: use the Supabase MCP's `apply_migration` (what's
been used so far), or `supabase db push` via the Supabase CLI once this repo
is linked to the project.
