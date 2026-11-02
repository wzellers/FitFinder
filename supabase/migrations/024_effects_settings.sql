-- Settings for the Outfits screen's animated effects: the weather (sky,
-- sun, clouds, rain, snow, lightning) and the seasonal themes (falling
-- leaves, holiday decorations). Both start on; each user can turn either
-- off in Settings → Effects. RLS on profiles already limits each user to
-- their own row.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weather_effects boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS seasonal_themes boolean NOT NULL DEFAULT true;
