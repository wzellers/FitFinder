-- The user's own order of pieces within each clothing type in the closet
-- (set by dragging). Null until a piece in that group is first dragged; those
-- sort after positioned ones, oldest first. Dirty pieces always sort last in
-- the app regardless of position. The table's existing own-row RLS policies
-- cover updating it.
ALTER TABLE public.clothing_items ADD COLUMN IF NOT EXISTS position integer;
