-- Migration: Drop original_image_url from clothing_items.
-- Run this in your Supabase SQL Editor.
--
-- Post-upload image editing (the "Revert to original" flow in Edit Item) has been
-- removed. Editing an item now only changes its type/colors, and images are final
-- once uploaded. The original_image_url column added in 010 is no longer written or
-- read by the app, so it is dropped here. Any data it held is discarded.

ALTER TABLE clothing_items DROP COLUMN IF EXISTS original_image_url;
