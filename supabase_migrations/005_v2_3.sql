-- v2.3 Migration: layering support, outerwear combos, occasion preferences
-- Safe to run multiple times (all statements are idempotent)

-- Ensure weather_preferences exists (guard for migration 004 not being applied)
CREATE TABLE IF NOT EXISTS weather_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  thresholds JSONB DEFAULT '{"cold": 45, "cool": 65, "warm": 80}',
  clothing_rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE weather_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own weather prefs"
    ON weather_preferences FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add outerwear_combinations column to color_preferences
ALTER TABLE color_preferences
  ADD COLUMN IF NOT EXISTS outerwear_combinations JSONB DEFAULT '[]';

-- Occasion preferences table
CREATE TABLE IF NOT EXISTS occasion_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE occasion_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users manage own occasion prefs"
    ON occasion_preferences FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Layer support: add layer_id to outfit_wears
ALTER TABLE outfit_wears
  ADD COLUMN IF NOT EXISTS layer_id UUID REFERENCES clothing_items(id) ON DELETE SET NULL;
