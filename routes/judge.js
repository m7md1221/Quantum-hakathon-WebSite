const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { pool } = require('../db');

const router = express.Router();

// Get maximum score for a criterion based on its field name
function getMaxScoreForCriterion(criterionKey) {
  const max15Criteria = ['problem_importance', 'ai_quantum_use', 'innovation', 'social_impact'];
  const max10Criteria = ['sdgs', 'code_quality', 'performance', 'presentation'];
  
  if (max15Criteria.includes(criterionKey)) {
    return 15;
  } else if (max10Criteria.includes(criterionKey)) {
    return 10;
  }
  return 10; // Default fallback
}

// Get evaluation scores for a specific team (for current judge)
router.get('/team-evaluation', authenticate, authorize(['judge']), async (req, res) => {
  try {
    const { teamId } = req.query;
    
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required' });
    }

    // Get judge info
    const judgeResult = await pool.query(
      'SELECT id, hall FROM judges WHERE user_id = $1',
      [req.user.id]
    );

    if (judgeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Judge not found' });
    }

    const judgeId = judgeResult.rows[0].id;
    const judgeHall = judgeResult.rows[0].hall;

    // Check if team is in judge's hall
    const teamResult = await pool.query('SELECT hall FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (teamResult.rows[0].hall !== judgeHall) {
      return res.status(403).json({ message: 'You can only view evaluations for teams in your hall' });
    }

    // Get evaluation ID
    const evaluationResult = await pool.query(
      'SELECT id FROM evaluations WHERE judge_id = $1 AND team_id = $2',
      [judgeId, teamId]
    );

    if (evaluationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Evaluation not found' });
    }

    const evaluationId = evaluationResult.rows[0].id;

    // Get all scores for this evaluation
    const scoresResult = await pool.query(
      'SELECT criterion_key, score FROM evaluation_scores WHERE evaluation_id = $1',
      [evaluationId]
    );

    // Convert to object format: { criterion_key: score }
    const scores = {};
    scoresResult.rows.forEach(row => {
      scores[row.criterion_key] = parseFloat(row.score);
    });

    res.json({ scores });
  } catch (error) {
    console.error('Error fetching team evaluation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get teams for judge's hall
router.get('/teams', authenticate, authorize(['judge']), async (req, res) => {
  try {
    // Get judge info (hall + id)
    const judgeResult = await pool.query(
      'SELECT id, hall FROM judges WHERE user_id = $1',
      [req.user.id]
    );

    if (judgeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Judge not found' });
    }

    const judgeId = judgeResult.rows[0].id;
    const hall = judgeResult.rows[0].hall;

    // Fetch teams in judge's hall and whether THIS judge already evaluated them
    const teams = await pool.query(
      `
      SELECT
        t.id,
        u.team_number,
        u.name,
        t.hall,
        p.submitted_at,
        EXISTS (
          SELECT 1
          FROM evaluations e
          WHERE e.team_id = t.id
            AND e.judge_id = $2
        ) AS evaluated
      FROM teams t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.id = p.team_id
      WHERE t.hall = $1
      ORDER BY t.id
    `,
      [hall, judgeId]
    );

    res.json(teams.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Evaluate team
router.post('/evaluate', authenticate, authorize(['judge']), async (req, res) => {
  const { teamId, scores } = req.body; // scores: { criterion_key: score }

  console.log('Evaluate request:', { teamId, scores, userId: req.user.id });

  // Validate input
  if (!teamId || !scores || typeof scores !== 'object') {
    return res.status(400).json({ message: 'Invalid request: teamId and scores are required' });
  }

  // Validate scores
  for (const [key, score] of Object.entries(scores)) {
    const numScore = parseFloat(score);
    const maxScore = getMaxScoreForCriterion(key);
    if (isNaN(numScore) || numScore < 0 || numScore > maxScore) {
      return res.status(400).json({ message: `Invalid score for ${key}: must be between 0 and ${maxScore}` });
    }
  }

  try {
    const judgeResult = await pool.query('SELECT id, hall FROM judges WHERE user_id = $1', [req.user.id]);
    if (judgeResult.rows.length === 0) {
      console.log('Judge not found for user:', req.user.id);
      return res.status(404).json({ message: 'Judge not found' });
    }

    const judgeId = judgeResult.rows[0].id;
    const judgeHall = judgeResult.rows[0].hall;
    console.log('Judge info:', { judgeId, judgeHall });

    // Check if team is in judge's hall
    const teamResult = await pool.query('SELECT hall FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      console.log('Team not found:', teamId);
      return res.status(404).json({ message: 'Team not found' });
    }

    const teamHall = teamResult.rows[0].hall;
    console.log('Team hall:', teamHall);

    if (teamHall !== judgeHall) {
      console.log('Hall mismatch:', { teamHall, judgeHall });
      return res.status(403).json({ message: 'You can only evaluate teams in your hall' });
    }

    // Insert or update evaluation and get ID
    const evaluationResult = await pool.query(`
      INSERT INTO evaluations (judge_id, team_id)
      VALUES ($1, $2)
      ON CONFLICT (judge_id, team_id) DO UPDATE SET judge_id = EXCLUDED.judge_id
      RETURNING id
    `, [judgeId, teamId]);

    // If no rows returned (shouldn't happen), try to get existing evaluation
    let evaluationId;
    if (evaluationResult.rows.length > 0) {
      evaluationId = evaluationResult.rows[0].id;
    } else {
      const existingResult = await pool.query(
        'SELECT id FROM evaluations WHERE judge_id = $1 AND team_id = $2',
        [judgeId, teamId]
      );
      if (existingResult.rows.length === 0) {
        throw new Error('Failed to create or find evaluation');
      }
      evaluationId = existingResult.rows[0].id;
    }
    console.log('Evaluation ID:', evaluationId);

    // Insert scores
    for (const [key, score] of Object.entries(scores)) {
      const numScore = parseFloat(score);
      console.log('Inserting score:', { key, score: numScore });
      await pool.query(`
        INSERT INTO evaluation_scores (evaluation_id, criterion_key, score)
        VALUES ($1, $2, $3)
        ON CONFLICT (evaluation_id, criterion_key) DO UPDATE SET score = EXCLUDED.score
      `, [evaluationId, key, numScore]);
    }

    console.log('Evaluation saved successfully');
    res.json({ message: 'Evaluation saved successfully' });
  } catch (error) {
    console.error('Error in evaluate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit evaluation (Final)
// Submit evaluation (Final)
// Submit evaluation (Final)
router.post('/finalize-evaluation', authenticate, authorize(['judge']), async (req, res) => {
  console.log('Received /finalize-evaluation request');
  const { teamId, scores, is_final } = req.body;

  if (!is_final) {
    return res.status(400).json({ message: 'Only final submissions are allowed via this endpoint' });
  }

  // Validate input
  if (!teamId || !scores || typeof scores !== 'object') {
    return res.status(400).json({ message: 'Invalid request: teamId and scores are required' });
  }

  let client;
  try {
    console.log('Connecting to pool...');
    client = await pool.connect();
    console.log('Connected.');

    const judgeResult = await client.query('SELECT id, hall FROM judges WHERE user_id = $1', [req.user.id]);
    if (judgeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Judge not found' });
    }

    const judgeId = judgeResult.rows[0].id;
    const judgeHall = judgeResult.rows[0].hall;

    // Check if team is in judge's hall
    const teamResult = await client.query('SELECT hall FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (teamResult.rows[0].hall !== judgeHall) {
      return res.status(403).json({ message: 'You can only evaluate teams in your hall' });
    }

    // CHECK IF ALREADY EVALUATED
    const existingEvaluation = await client.query(
      'SELECT id FROM evaluations WHERE judge_id = $1 AND team_id = $2',
      [judgeId, teamId]
    );

    if (existingEvaluation.rows.length > 0) {
      return res.status(400).json({ message: 'Team already evaluated. You cannot modify this evaluation.' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Create evaluation
    const evaluationResult = await client.query(
      'INSERT INTO evaluations (judge_id, team_id) VALUES ($1, $2) RETURNING id',
      [judgeId, teamId]
    );
    const evaluationId = evaluationResult.rows[0].id;

    // Insert scores
    for (const [key, score] of Object.entries(scores)) {
      const numScore = parseFloat(score);
      const maxScore = getMaxScoreForCriterion(key);
      if (isNaN(numScore) || numScore < 0 || numScore > maxScore) {
        throw new Error(`Invalid score for ${key}: must be between 0 and ${maxScore}`);
      }
      await client.query(
        'INSERT INTO evaluation_scores (evaluation_id, criterion_key, score) VALUES ($1, $2, $3)',
        [evaluationId, key, numScore]
      );
    }

    await client.query('COMMIT');
    console.log('Evaluation submitted successfully');
    res.json({ message: 'Evaluation submitted successfully' });

  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { console.error('Rollback failed:', e); }
    }
    console.error('Error in submit-evaluation:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;