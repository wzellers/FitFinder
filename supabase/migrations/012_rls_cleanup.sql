BEGIN;

-- ============================================================
-- 1. PUBLIC TABLE POLICIES
-- ============================================================

-- --- profiles ---
DROP POLICY IF EXISTS "Users can delete own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Insert own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"  ON public.profiles;
DROP POLICY IF EXISTS "profiles insert own"           ON public.profiles;
DROP POLICY IF EXISTS "Select own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"    ON public.profiles;
DROP POLICY IF EXISTS "profiles select own"           ON public.profiles;
DROP POLICY IF EXISTS "Update own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.profiles;
DROP POLICY IF EXISTS "profiles update own"           ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE TO authenticated USING ((select auth.uid()) = id);

-- --- clothing_items ---
DROP POLICY IF EXISTS "Users can view own clothing items"    ON public.clothing_items;
DROP POLICY IF EXISTS "Users can insert own clothing items"  ON public.clothing_items;
DROP POLICY IF EXISTS "Users can update own clothing items"  ON public.clothing_items;
DROP POLICY IF EXISTS "Users can delete own clothing items"  ON public.clothing_items;

CREATE POLICY "clothing_items_select_own" ON public.clothing_items
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "clothing_items_insert_own" ON public.clothing_items
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "clothing_items_update_own" ON public.clothing_items
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "clothing_items_delete_own" ON public.clothing_items
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- --- color_preferences ---
DROP POLICY IF EXISTS "prefs upsert own"                       ON public.color_preferences;
DROP POLICY IF EXISTS "Users can delete own color preferences"  ON public.color_preferences;
DROP POLICY IF EXISTS "prefs delete own"                        ON public.color_preferences;
DROP POLICY IF EXISTS "Users can insert own color preferences"  ON public.color_preferences;
DROP POLICY IF EXISTS "Users can view own color preferences"    ON public.color_preferences;
DROP POLICY IF EXISTS "prefs select own"                        ON public.color_preferences;
DROP POLICY IF EXISTS "Users can update own color preferences"  ON public.color_preferences;

CREATE POLICY "color_preferences_select_own" ON public.color_preferences
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "color_preferences_insert_own" ON public.color_preferences
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "color_preferences_update_own" ON public.color_preferences
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "color_preferences_delete_own" ON public.color_preferences
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- --- saved_outfits ---
DROP POLICY IF EXISTS "Users can view own saved outfits"    ON public.saved_outfits;
DROP POLICY IF EXISTS "Users can insert own saved outfits"  ON public.saved_outfits;
DROP POLICY IF EXISTS "Users can update own saved outfits"  ON public.saved_outfits;
DROP POLICY IF EXISTS "Users can delete own saved outfits"  ON public.saved_outfits;

CREATE POLICY "saved_outfits_select_own" ON public.saved_outfits
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "saved_outfits_insert_own" ON public.saved_outfits
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "saved_outfits_update_own" ON public.saved_outfits
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "saved_outfits_delete_own" ON public.saved_outfits
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- --- outfit_wears ---
DROP POLICY IF EXISTS "Users can view own outfit wears"    ON public.outfit_wears;
DROP POLICY IF EXISTS "Users can insert own outfit wears"  ON public.outfit_wears;
DROP POLICY IF EXISTS "Users can update own outfit wears"  ON public.outfit_wears;
DROP POLICY IF EXISTS "Users can delete own outfit wears"  ON public.outfit_wears;

CREATE POLICY "outfit_wears_select_own" ON public.outfit_wears
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "outfit_wears_insert_own" ON public.outfit_wears
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_wears_update_own" ON public.outfit_wears
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_wears_delete_own" ON public.outfit_wears
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- --- weather_preferences ---
DROP POLICY IF EXISTS "Users manage own weather prefs"     ON public.weather_preferences;
DROP POLICY IF EXISTS "Users can insert own weather prefs" ON public.weather_preferences;
DROP POLICY IF EXISTS "Users can view own weather prefs"   ON public.weather_preferences;
DROP POLICY IF EXISTS "Users can update own weather prefs" ON public.weather_preferences;

CREATE POLICY "weather_preferences_select_own" ON public.weather_preferences
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "weather_preferences_insert_own" ON public.weather_preferences
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "weather_preferences_update_own" ON public.weather_preferences
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "weather_preferences_delete_own" ON public.weather_preferences
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- --- outfit_model_weights ---
DROP POLICY IF EXISTS "Users manage own outfit model weights" ON public.outfit_model_weights;

CREATE POLICY "outfit_model_weights_select_own" ON public.outfit_model_weights
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "outfit_model_weights_insert_own" ON public.outfit_model_weights
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_model_weights_update_own" ON public.outfit_model_weights
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "outfit_model_weights_delete_own" ON public.outfit_model_weights
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- --- layer_preferences ---
DROP POLICY IF EXISTS "Users manage own layer prefs" ON public.layer_preferences;

CREATE POLICY "layer_preferences_select_own" ON public.layer_preferences
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "layer_preferences_insert_own" ON public.layer_preferences
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "layer_preferences_update_own" ON public.layer_preferences
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "layer_preferences_delete_own" ON public.layer_preferences
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- --- occasion_preferences ---
DROP POLICY IF EXISTS "Users manage own occasion prefs" ON public.occasion_preferences;

CREATE POLICY "occasion_preferences_select_own" ON public.occasion_preferences
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "occasion_preferences_insert_own" ON public.occasion_preferences
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "occasion_preferences_update_own" ON public.occasion_preferences
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "occasion_preferences_delete_own" ON public.occasion_preferences
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);


-- ============================================================
-- 2. STORAGE POLICIES (clothing-images only)
-- ============================================================

DROP POLICY IF EXISTS "Users can view own images"   ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own images"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images"  ON storage.objects;

CREATE POLICY "clothing_images_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'clothing-images'
    AND (select auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "clothing_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clothing-images'
    AND (select auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "clothing_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clothing-images'
    AND (select auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'clothing-images'
    AND (select auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "clothing_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clothing-images'
    AND (select auth.uid())::text = (storage.foldername(name))[1]);


-- ============================================================
-- 3. FUNCTIONS: set search_path = ''
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $function$
begin
  new.updated_at = now(); return new;
end $function$;

CREATE OR REPLACE FUNCTION public.enforce_color_preferences_uniqueness()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $function$
DECLARE
  liked RECORD;
  disliked RECORD;
  liked_set TEXT[] := ARRAY[]::TEXT[];
  disliked_set TEXT[] := ARRAY[]::TEXT[];
  key TEXT;
BEGIN
  FOR liked IN SELECT lower((elem->>'topColor')) AS top, lower((elem->>'bottomColor')) AS bottom
               FROM jsonb_array_elements(COALESCE(NEW.liked_combinations, '[]'::jsonb)) AS elem
  LOOP
    key := liked.top || '__' || liked.bottom;
    IF key = '__' THEN
      RAISE EXCEPTION 'Color combinations must include both topColor and bottomColor';
    END IF;
    IF key = ANY(liked_set) THEN
      RAISE EXCEPTION 'Duplicate combination (%) in liked_combinations', key;
    END IF;
    liked_set := array_append(liked_set, key);
  END LOOP;

  FOR disliked IN SELECT lower((elem->>'topColor')) AS top, lower((elem->>'bottomColor')) AS bottom
                  FROM jsonb_array_elements(COALESCE(NEW.disliked_combinations, '[]'::jsonb)) AS elem
  LOOP
    key := disliked.top || '__' || disliked.bottom;
    IF key = '__' THEN
      RAISE EXCEPTION 'Color combinations must include both topColor and bottomColor';
    END IF;
    IF key = ANY(disliked_set) THEN
      RAISE EXCEPTION 'Duplicate combination (%) in disliked_combinations', key;
    END IF;
    IF key = ANY(liked_set) THEN
      RAISE EXCEPTION 'Combination (%) exists in both liked and disliked lists', key;
    END IF;
    disliked_set := array_append(disliked_set, key);
  END LOOP;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;


-- ============================================================
-- 4. INDEXES on unindexed foreign keys
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_outfit_wears_outfit_id    ON public.outfit_wears (outfit_id);
CREATE INDEX IF NOT EXISTS idx_outfit_wears_top_id       ON public.outfit_wears (top_id);
CREATE INDEX IF NOT EXISTS idx_outfit_wears_bottom_id    ON public.outfit_wears (bottom_id);
CREATE INDEX IF NOT EXISTS idx_outfit_wears_layer_id     ON public.outfit_wears (layer_id);
CREATE INDEX IF NOT EXISTS idx_outfit_wears_outerwear_id ON public.outfit_wears (outerwear_id);
CREATE INDEX IF NOT EXISTS idx_outfit_wears_shoes_id     ON public.outfit_wears (shoes_id);
CREATE INDEX IF NOT EXISTS idx_saved_outfits_user_id     ON public.saved_outfits (user_id);

COMMIT;
