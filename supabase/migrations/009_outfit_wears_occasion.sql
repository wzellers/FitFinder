-- Migration: record the occasion an outfit was worn for.
-- Run this in your Supabase SQL Editor.
--
-- Closes the occasion learning loop: the generator now lets the user pick an
-- occasion ("Casual" / "Work" / "Date" / "Active"), and storing it on the wear
-- lets the rating-time reward reconstruct the occasion fit feature so the
-- contextual bandit actually learns from it. NULL means no occasion ("Any").

ALTER TABLE outfit_wears ADD COLUMN IF NOT EXISTS occasion TEXT;
