-- T36 "strike while hot": lets the notification route (app-level, not a
-- DB trigger -- see src/app/api/notifications/hot-lead/route.ts) claim
-- "have we already notified the rep for this signal on this package?"
-- atomically, via a conditional UPDATE ... WHERE column IS NULL. No RLS
-- policy changes needed -- the route uses the admin client, same as every
-- other anonymous-prospect-facing write in this app (record_tracking_event
-- is SECURITY DEFINER for the same reason).
alter table public.packages
  add column first_view_notified_at timestamptz,
  add column video_played_notified_at timestamptz;
