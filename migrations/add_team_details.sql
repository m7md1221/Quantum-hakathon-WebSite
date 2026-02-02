-- Add team_number and team_institution columns to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS team_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS team_institution VARCHAR(255);

-- Add index for team_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_team_number ON users(team_number);
