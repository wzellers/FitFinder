-- Migration: Drop comfort_rating from outfit_wears
-- The comfort rating has been removed; outfit rating is now the sole signal.
-- Run this in your Supabase SQL Editor.

ALTER TABLE outfit_wears DROP COLUMN IF EXISTS comfort_rating;
