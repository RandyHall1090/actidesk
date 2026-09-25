-- The follow-through-daily job (0027) was scheduled with the raw
-- CRON_SECRET pasted into its command, so anyone who can read cron.job
-- could read the secret. Re-schedule it (same name, schedule, and URL the
-- live job already uses) to read the token from Vault at run time, like
-- the blog jobs in 0038. cron.schedule with an existing name replaces
-- that job's command in place.

select cron.schedule(
  'follow-through-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://premeeting.actiforge.ai/api/cron/follow-through',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
