-- Every outfit the generator shows, and what the user did with it, so we can
-- measure how good recommendations are for real users over time (rather than
-- only in the simulated benchmark).
--
-- predicted:      the model's expected score for the outfit when shown, 0–1.
-- model_ratings:  how many ratings the model had learned from by then.
-- outcome:        what happened next: skipped ("Try another"), rated (without
--                 wearing), worn ("Wear today") or saved; null if nothing.
-- rating:         the 1–10 rating, for outcome 'rated'.
--
-- Items are kept as plain ids (no foreign keys), so history survives deleting
-- a piece.
CREATE TABLE IF NOT EXISTS public.outfit_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  top_id uuid NOT NULL,
  bottom_id uuid NOT NULL,
  shoes_id uuid NOT NULL,
  predicted real NOT NULL CHECK (predicted BETWEEN 0 AND 1),
  model_ratings integer NOT NULL CHECK (model_ratings >= 0),
  outcome text CHECK (outcome IN ('skipped', 'rated', 'worn', 'saved')),
  rating smallint CHECK (rating BETWEEN 1 AND 10),
  shown_at timestamptz NOT NULL DEFAULT now(),
  outcome_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outfit_impressions_user_shown_at
  ON public.outfit_impressions (user_id, shown_at DESC);

ALTER TABLE public.outfit_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outfit_impressions_select_own" ON public.outfit_impressions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "outfit_impressions_insert_own" ON public.outfit_impressions
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_impressions_update_own" ON public.outfit_impressions
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_impressions_delete_own" ON public.outfit_impressions
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Weekly quality per user: how often the first-choice outfit is skipped vs
-- kept, and how kept outfits are rated. security_invoker: each user sees only
-- their own rows; the project owner sees everyone's in the SQL Editor.
CREATE OR REPLACE VIEW public.recommendation_quality
  WITH (security_invoker = true) AS
SELECT
  user_id,
  date_trunc('week', shown_at)::date AS week,
  count(*) AS shown,
  round(avg(coalesce((outcome = 'skipped')::int, 0))::numeric, 2) AS skip_rate,
  count(*) FILTER (WHERE outcome IN ('rated', 'worn', 'saved')) AS kept,
  round(avg(rating)::numeric, 1) AS avg_rating,
  round(avg(predicted)::numeric, 2) AS avg_predicted,
  max(model_ratings) AS model_ratings
FROM public.outfit_impressions
GROUP BY user_id, date_trunc('week', shown_at);
