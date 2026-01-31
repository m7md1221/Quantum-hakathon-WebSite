-- Migration: Add clean code columns to projects
-- Run this against the database if needed

BEGIN;

ALTER TABLE projects
  RENAME COLUMN IF EXISTS github_url TO github_repo_url;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS clean_code_score INTEGER;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS clean_code_report JSON;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS eslint_error_count INTEGER;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS eslint_warning_count INTEGER;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMP;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS clean_code_status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS clean_code_failure_reason TEXT;

COMMIT;

-- This migration is idempotent and safe to run multiple times.
