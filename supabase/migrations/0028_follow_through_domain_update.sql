-- Re-points the T38 follow-through cron job (0027) at the real production
-- domain now that it's confirmed: premeeting.actiforge.ai (the Vercel
-- project's custom domain), not the old securafy-shock-and-awe.vercel.app
-- default alias -- which still works, but isn't the canonical URL going
-- forward. pg_cron has no "alter job URL" -- unschedule + reschedule is
-- the only way to change an existing job's command.
--
-- The real secret is intentionally NOT committed here, same as 0027 --
-- applied directly to the live database with the real value substituted
-- for <CRON_SECRET>.
select cron.unschedule('follow-through-daily');

select cron.schedule(
  'follow-through-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/follow-through',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
