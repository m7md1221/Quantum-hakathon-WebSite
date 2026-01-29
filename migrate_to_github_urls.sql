-- Migration Script: Convert from file uploads to GitHub URLs
-- This script updates the projects table structure and migrates data
-- Run this BEFORE deploying the new version if you have an existing database

-- Step 1: Backup existing data (optional but recommended)
-- CREATE TABLE projects_backup AS SELECT * FROM projects;

-- Step 2: Drop the old projects table and recreate it with new schema
-- WARNING: This will delete all file_path data. Make sure to backup first!

DROP TABLE IF EXISTS projects CASCADE;

-- Step 3: Create new projects table with github_url column
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  github_url VARCHAR(500) NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id)
);

-- Step 4: If you want to restore old submissions with placeholder data:
-- Uncomment the following if you have backed up data and want to migrate it
-- INSERT INTO projects (team_id, github_url, submitted_at)
-- SELECT team_id, 'https://github.com/placeholder/replace-with-actual-url' as github_url, submitted_at
-- FROM projects_backup
-- WHERE submitted_at IS NOT NULL;

-- Step 5: Create index for performance
CREATE INDEX idx_projects_team_id ON projects(team_id);

-- Migration complete!
-- All teams now must submit GitHub repository URLs instead of ZIP files.
