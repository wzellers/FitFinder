CREATE TABLE IF NOT EXISTS weather_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  thresholds JSONB DEFAULT '{"cold": 45, "cool": 65, "warm": 80}',
  clothing_rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE weather_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own weather prefs"
  ON weather_preferences FOR ALL USING (auth.uid() = user_id);
