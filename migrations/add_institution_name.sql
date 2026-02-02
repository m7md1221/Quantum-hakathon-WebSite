-- Add institution_name column to users if missing
ALTER TABLE users
ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255);

-- Backfill institution_name from legacy team_institution if present
UPDATE users
SET institution_name = team_institution
WHERE institution_name IS NULL AND team_institution IS NOT NULL;
