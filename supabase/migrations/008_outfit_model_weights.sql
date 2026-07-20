-- Migration: per-user learned weights for the outfit contextual bandit.
-- Run this in your Supabase SQL Editor.
--
-- One row per user. `weights` holds the learned linear-model parameters
-- (feature weights + bias) and `feature_meta` holds versioning / update count.
-- See src/lib/banditModel.ts for the serialized shape.

CREATE TABLE IF NOT EXISTS outfit_model_weights (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  weights JSONB NOT NULL DEFAULT '{}',
  feature_meta JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE outfit_model_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own outfit model weights"
  ON outfit_model_weights FOR ALL USING (auth.uid() = user_id);
