-- Schedules the AI blog-generation cron, one job per author, matching
-- Forge University's exact cadence: every weekday, one author per hour
-- (13:00/14:00/15:00/16:00 UTC). Same net.http_post + Bearer CRON_SECRET
-- pattern as this repo's existing follow-through-daily job (migration
-- 0027), but reads the token from Supabase Vault by name at run time
-- (vault.decrypted_secrets, secret already created out-of-band as
-- 'cron_secret') instead of embedding the raw secret in this file --
-- 0027 embeds it literally, a pre-existing pattern this migration
-- deliberately does not repeat, since this file is committed to git.
-- Weekdays only ("1-5") -- unlike follow-through-daily, which
-- intentionally runs every day.

select cron.schedule(
  'blog-generate-randy',
  '0 13 * * 1-5',
  $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=randy',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);

select cron.schedule(
  'blog-generate-rodney',
  '0 14 * * 1-5',
  $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=rodney',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);

select cron.schedule(
  'blog-generate-ric',
  '0 15 * * 1-5',
  $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=ric',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);

select cron.schedule(
  'blog-generate-jillian',
  '0 16 * * 1-5',
  $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=jillian',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
