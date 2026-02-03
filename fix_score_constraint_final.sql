-- Fix evaluation_scores score constraint to allow up to 15
-- Some criteria have max score of 15, but the constraint only allows up to 10

-- Drop the old constraint
ALTER TABLE evaluation_scores DROP CONSTRAINT IF EXISTS evaluation_scores_score_check;

-- Add new constraint that allows scores up to 15
ALTER TABLE evaluation_scores ADD CONSTRAINT evaluation_scores_score_check CHECK (score >= 0 AND score <= 15);

-- Verify the change
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'evaluation_scores'::regclass
  AND conname = 'evaluation_scores_score_check';
