-- What the outfit model learned from each wear, so ratings train on the
-- outfit as it was when worn, and Calendar edits can undo and redo learning
-- exactly.
--
-- features:        { "items": [top_id, bottom_id, shoes_id], "values": { color,
--                  weather, variety, occasion, rating } } — the outfit's feature
--                  vector when worn (from "Wear today"), or rebuilt as of that
--                  day. If learned_rating is set, these are exactly the features
--                  the model learned it with.
-- learned_rating:  the rating the model has learned from this wear, or null.
--
-- Additive only; safe to apply before the app version that uses it.
ALTER TABLE public.outfit_wears
  ADD COLUMN IF NOT EXISTS features jsonb,
  ADD COLUMN IF NOT EXISTS learned_rating smallint
    CHECK (learned_rating IS NULL OR learned_rating BETWEEN 1 AND 10);
