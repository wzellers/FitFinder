-- Migration: Create outfit_wears table for tracking outfit history
-- Run this in your Supabase SQL Editor

-- Create the outfit_wears table
CREATE TABLE IF NOT EXISTS outfit_wears (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES saved_outfits(id) ON DELETE SET NULL,
  top_id UUID REFERENCES clothing_items(id) ON DELETE SET NULL,
  bottom_id UUID REFERENCES clothing_items(id) ON DELETE SET NULL,
  shoes_id UUID REFERENCES clothing_items(id) ON DELETE SET NULL,
  outerwear_id UUID REFERENCES clothing_items(id) ON DELETE SET NULL,
  worn_date DATE NOT NULL,
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  comfort_rating INTEGER CHECK (comfort_rating >= 1 AND comfort_rating <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups by user and date
CREATE INDEX IF NOT EXISTS idx_outfit_wears_user_date ON outfit_wears(user_id, worn_date);

-- Create index for lookups by worn_date (for calendar queries)
CREATE INDEX IF NOT EXISTS idx_outfit_wears_date ON outfit_wears(worn_date);

-- Enable Row Level Security
ALTER TABLE outfit_wears ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own outfit wears
CREATE POLICY "Users can view own outfit wears" ON outfit_wears
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own outfit wears
CREATE POLICY "Users can insert own outfit wears" ON outfit_wears
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own outfit wears
CREATE POLICY "Users can update own outfit wears" ON outfit_wears
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own outfit wears
CREATE POLICY "Users can delete own outfit wears" ON outfit_wears
  FOR DELETE USING (auth.uid() = user_id);
