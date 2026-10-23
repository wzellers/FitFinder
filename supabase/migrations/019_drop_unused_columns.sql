-- Drop columns the app no longer reads or writes. Apply only after the app
-- version that stops writing color_preferences.disliked_combinations is
-- deployed, or saving color preferences fails.
BEGIN;

-- The uniqueness trigger also checked disliked_combinations. Keep its checks
-- on liked_combinations (both colors set, no duplicates) and the updated_at
-- stamp; drop the disliked part.
CREATE OR REPLACE FUNCTION public.enforce_color_preferences_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  liked RECORD;
  liked_set TEXT[] := ARRAY[]::TEXT[];
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

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Outerwear and a separate layer slot were folded into tops; their foreign
-- keys and indexes go with the columns.
ALTER TABLE public.outfit_wears
  DROP COLUMN outerwear_id,
  DROP COLUMN layer_id;

ALTER TABLE public.color_preferences
  DROP COLUMN outerwear_combinations,
  DROP COLUMN disliked_combinations;

-- Profile pictures were removed in 013; preferences was never used.
ALTER TABLE public.profiles
  DROP COLUMN preferences,
  DROP COLUMN profile_picture_url;

COMMIT;
