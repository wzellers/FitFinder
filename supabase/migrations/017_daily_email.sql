-- Daily outfit email: opt-in, send time and time zone per user.
--
-- The sender (an AWS Lambda using the service-role key) reads opted-in
-- profiles every 15 minutes, sends to users whose local time has passed
-- daily_email_time, and records the local date in daily_email_last_sent so
-- each user gets at most one email per day.
ALTER TABLE public.profiles
  ADD COLUMN daily_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN daily_email_time time NOT NULL DEFAULT '07:00',
  ADD COLUMN timezone text CHECK (timezone IS NULL OR length(timezone) BETWEEN 1 AND 64),
  ADD COLUMN daily_email_last_sent date,
  ADD COLUMN email_unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- One-click unsubscribe from the email's link, without signing in. Knowing
-- the (random, per-user) token is the authorization; the function can only
-- turn the email off, and says nothing about whose token it was.
CREATE OR REPLACE FUNCTION public.unsubscribe_daily_email(token uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH updated AS (
    UPDATE public.profiles
    SET daily_email_enabled = false
    WHERE email_unsubscribe_token = token
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_daily_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_daily_email(uuid) TO anon, authenticated;
