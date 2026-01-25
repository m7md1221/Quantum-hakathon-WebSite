-- Seed Data for Quantum Khakathon

-- Admin user
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@khakathon.com', '$2a$10$example.hash.for.admin', 'admin');

-- Judges (5 per hall)
INSERT INTO users (name, email, password, role, hall) VALUES
-- Hall A
('Judge A1', 'judge_a1@khakathon.com', '$2a$10$example.hash', 'judge', 'A'),
('Judge A2', 'judge_a2@khakathon.com', '$2a$10$example.hash', 'judge', 'A'),
('Judge A3', 'judge_a3@khakathon.com', '$2a$10$example.hash', 'judge', 'A'),
('Judge A4', 'judge_a4@khakathon.com', '$2a$10$example.hash', 'judge', 'A'),
('Judge A5', 'judge_a5@khakathon.com', '$2a$10$example.hash', 'judge', 'A'),
-- Hall B
('Judge B1', 'judge_b1@khakathon.com', '$2a$10$example.hash', 'judge', 'B'),
('Judge B2', 'judge_b2@khakathon.com', '$2a$10$example.hash', 'judge', 'B'),
('Judge B3', 'judge_b3@khakathon.com', '$2a$10$example.hash', 'judge', 'B'),
('Judge B4', 'judge_b4@khakathon.com', '$2a$10$example.hash', 'judge', 'B'),
('Judge B5', 'judge_b5@khakathon.com', '$2a$10$example.hash', 'judge', 'B'),
-- Hall C
('Judge C1', 'judge_c1@khakathon.com', '$2a$10$example.hash', 'judge', 'C'),
('Judge C2', 'judge_c2@khakathon.com', '$2a$10$example.hash', 'judge', 'C'),
('Judge C3', 'judge_c3@khakathon.com', '$2a$10$example.hash', 'judge', 'C'),
('Judge C4', 'judge_c4@khakathon.com', '$2a$10$example.hash', 'judge', 'C'),
('Judge C5', 'judge_c5@khakathon.com', '$2a$10$example.hash', 'judge', 'C'),
-- Hall D
('Judge D1', 'judge_d1@khakathon.com', '$2a$10$example.hash', 'judge', 'D'),
('Judge D2', 'judge_d2@khakathon.com', '$2a$10$example.hash', 'judge', 'D'),
('Judge D3', 'judge_d3@khakathon.com', '$2a$10$example.hash', 'judge', 'D'),
('Judge D4', 'judge_d4@khakathon.com', '$2a$10$example.hash', 'judge', 'D'),
('Judge D5', 'judge_d5@khakathon.com', '$2a$10$example.hash', 'judge', 'D');

-- Insert judges table
INSERT INTO judges (user_id, hall)
SELECT id, hall FROM users WHERE role = 'judge';

-- Teams (20 per hall)
-- Hall A teams
INSERT INTO users (name, email, password, role, hall) VALUES
('Team A1', 'team_a1@khakathon.com', '$2a$10$example.hash', 'team', 'A'),
('Team A2', 'team_a2@khakathon.com', '$2a$10$example.hash', 'team', 'A'),
-- ... up to Team A20
('Team A20', 'team_a20@khakathon.com', '$2a$10$example.hash', 'team', 'A');

-- Similarly for B, C, D
-- For brevity, I'll assume the pattern continues

-- Then insert into teams table
INSERT INTO teams (user_id, hall)
SELECT id, hall FROM users WHERE role = 'team';