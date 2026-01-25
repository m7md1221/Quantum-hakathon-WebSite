-- Migration: Add UNIQUE constraint to evaluation_scores table
-- This fixes the ON CONFLICT error when judges submit evaluations

-- Add UNIQUE constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'evaluation_scores_evaluation_id_criterion_key_key'
    ) THEN
        ALTER TABLE evaluation_scores 
        ADD CONSTRAINT evaluation_scores_evaluation_id_criterion_key_key 
        UNIQUE (evaluation_id, criterion_key);
    END IF;
END $$;
