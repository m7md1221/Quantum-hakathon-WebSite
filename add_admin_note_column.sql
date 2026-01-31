-- Add admin_note column to evaluation_scores table
ALTER TABLE evaluation_scores ADD COLUMN admin_note TEXT DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX idx_evaluation_scores_admin_modified ON evaluation_scores(admin_note);
