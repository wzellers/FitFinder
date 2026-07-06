-- Migration: keep each item's original image so a crop/edit can be undone.
-- Run this in your Supabase SQL Editor.
--
-- When a user crops or replaces an item's photo we now store the edited image as
-- image_url while preserving the first-uploaded image in original_image_url. The
-- "Revert to original" action in Edit Item points image_url back at this value.
-- NULL means the item predates this column (no preserved original to revert to).
--
-- Backfill: for existing items, treat their current image as the original so
-- reverting is a no-op rather than broken.

ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS original_image_url TEXT;

UPDATE clothing_items
SET original_image_url = image_url
WHERE original_image_url IS NULL;
