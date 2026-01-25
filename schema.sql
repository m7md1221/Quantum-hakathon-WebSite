-- Database Schema for Quantum Khakathon

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'judge', 'team')),
  hall VARCHAR(1) CHECK (hall IN ('A', 'B', 'C', 'D')) -- NULL for admin
);

-- Teams table
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  hall VARCHAR(1) NOT NULL CHECK (hall IN ('A', 'B', 'C', 'D'))
);

-- Judges table
CREATE TABLE judges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  hall VARCHAR(1) NOT NULL CHECK (hall IN ('A', 'B', 'C', 'D'))
);

-- Projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evaluations table
CREATE TABLE evaluations (
  id SERIAL PRIMARY KEY,
  judge_id INTEGER REFERENCES judges(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE(judge_id, team_id)
);

-- Evaluation criteria table (predefined)
CREATE TABLE criteria (
  key VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  weight DECIMAL(5,2) NOT NULL
);

-- Evaluation scores table
CREATE TABLE evaluation_scores (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER REFERENCES evaluations(id) ON DELETE CASCADE,
  criterion_key VARCHAR(50) REFERENCES criteria(key) ON DELETE CASCADE,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 10),
  UNIQUE(evaluation_id, criterion_key)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_teams_hall ON teams(hall);
CREATE INDEX idx_judges_hall ON judges(hall);
CREATE INDEX idx_evaluations_judge_team ON evaluations(judge_id, team_id);
CREATE INDEX idx_evaluation_scores_evaluation ON evaluation_scores(evaluation_id);

-- Insert predefined criteria
INSERT INTO criteria (key, name, weight) VALUES
('problem_importance', 'Problem & Importance', 15.00),
('ai_quantum_use', 'Use of AI / Quantum Computing', 15.00),
('sdgs', 'UN Sustainable Development Goals (SDGs)', 10.00),
('innovation', 'Innovation & Creativity', 15.00),
('social_impact', 'Social Impact', 15.00),
('code_quality', 'Code Quality & Extensibility', 10.00),
('performance', 'Performance & Result Quality', 10.00),
('presentation', 'Presentation & Teamwork', 10.00);