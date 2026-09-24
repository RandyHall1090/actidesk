-- net.http_post defaults to a 5-second timeout, but a generation run
-- (web research + a ~1,500-word article + cover image) takes minutes --
-- the first real test run (2026-09-24) hit "Timeout of 5000 ms reached"
-- on the database side while the route was still working. 15 minutes
-- clears the route's own 800s maxDuration, so pg_net waits for the real
-- response instead of dropping the connection early. Same commands as
-- 0038 otherwise (token still read from Vault by name).

select cron.alter_job(
  (select jobid from cron.job where jobname = 'blog-generate-randy'),
  command := $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=randy',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 900000
  );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'blog-generate-rodney'),
  command := $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=rodney',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 900000
  );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'blog-generate-ric'),
  command := $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=ric',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 900000
  );
  $$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'blog-generate-jillian'),
  command := $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/generate-blog-post?authorSlug=jillian',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 900000
  );
  $$
);
