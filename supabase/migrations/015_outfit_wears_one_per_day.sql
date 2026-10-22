-- One logged outfit per user per day. The app already assumes this (Wear
-- today checks first, and the calendar edits the existing entry), but only
-- the database can enforce it against double-clicks and two open tabs.
ALTER TABLE public.outfit_wears
  ADD CONSTRAINT outfit_wears_user_day_key UNIQUE (user_id, worn_date);
