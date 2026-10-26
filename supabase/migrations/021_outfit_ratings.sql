-- Ratings of outfits the user didn't wear: from the Outfits tab, rate what's
-- shown and get the next one. Each rating trains the outfit model (like a worn
-- one) and feeds the "rating" feature, the model's memory of well-rated items.
--
-- features: { "items": [top_id, bottom_id, shoes_id], "values": { ... } }, the
-- feature vector the model learned this rating with.
CREATE TABLE IF NOT EXISTS public.outfit_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  top_id uuid NOT NULL REFERENCES public.clothing_items(id) ON DELETE CASCADE,
  bottom_id uuid NOT NULL REFERENCES public.clothing_items(id) ON DELETE CASCADE,
  shoes_id uuid NOT NULL REFERENCES public.clothing_items(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 10),
  features jsonb,
  rated_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outfit_ratings_user_rated_on
  ON public.outfit_ratings (user_id, rated_on DESC);
-- Foreign keys used by ON DELETE CASCADE when an item is deleted.
CREATE INDEX IF NOT EXISTS idx_outfit_ratings_top ON public.outfit_ratings (top_id);
CREATE INDEX IF NOT EXISTS idx_outfit_ratings_bottom ON public.outfit_ratings (bottom_id);
CREATE INDEX IF NOT EXISTS idx_outfit_ratings_shoes ON public.outfit_ratings (shoes_id);

ALTER TABLE public.outfit_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outfit_ratings_select_own" ON public.outfit_ratings
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "outfit_ratings_insert_own" ON public.outfit_ratings
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_ratings_update_own" ON public.outfit_ratings
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_ratings_delete_own" ON public.outfit_ratings
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
