-- Daily outfit email: every 15 minutes, call the app's sender route
-- (POST /api/email/send-due), which emails each opted-in user whose local
-- send time has passed.
--
-- The route's URL and its CRON_SECRET are read from Supabase Vault at run
-- time, so neither is stored in this file. Create them once, by hand:
--
--   select vault.create_secret('https://<your-app>/api/email/send-due', 'daily_email_url');
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'daily_email_cron_secret');
--
-- Until both exist the job does nothing.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'send-daily-emails',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := s.url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || s.secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  FROM (
    SELECT
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'daily_email_url') AS url,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'daily_email_cron_secret') AS secret
  ) AS s
  WHERE s.url IS NOT NULL AND s.secret IS NOT NULL;
  $$
);
