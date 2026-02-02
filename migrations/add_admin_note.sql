-- Add admin_note column to evaluation_scores if it doesn't exist
ALTER TABLE evaluation_scores
ADD COLUMN IF NOT EXISTS admin_note TEXT;
