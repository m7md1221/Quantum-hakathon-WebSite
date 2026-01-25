const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { pool } = require('../db');

const router = express.Router();

// Get all teams with scores
router.get('/teams', authenticate, authorize(['admin']), async (req, res) => {
  try {
    // First get basic team info
    const teamsResult = await pool.query(`
      SELECT
        t.id,
        u.name,
        t.hall,
        p.submitted_at,
        (SELECT COUNT(*) FROM evaluations WHERE team_id = t.id) as evaluation_count
      FROM teams t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.id = p.team_id
      GROUP BY t.id, u.name, t.hall, p.submitted_at
    `);

    // For each team, calculate scores
    const teams = await Promise.all(teamsResult.rows.map(async (team) => {
      const teamId = parseInt(team.id);
      
      // Get judge totals for this team
      const judgeScoresResult = await pool.query(`
        SELECT 
          e.judge_id,
          SUM(es.score * c.weight / 100) as judge_total
        FROM evaluations e
        JOIN evaluation_scores es ON e.id = es.evaluation_id
        JOIN criteria c ON es.criterion_key = c.key
        WHERE e.team_id = $1
        GROUP BY e.judge_id
      `, [teamId]);

      let totalScore = 0;
      let averageScore = 0;

      if (judgeScoresResult.rows.length > 0) {
        const judgeTotals = judgeScoresResult.rows.map(r => parseFloat(r.judge_total) || 0);
        totalScore = judgeTotals.reduce((sum, score) => sum + score, 0);
        averageScore = totalScore / judgeTotals.length;
      }

      return {
        id: teamId,
        name: team.name,
        hall: team.hall,
        submitted_at: team.submitted_at,
        evaluation_count: parseInt(team.evaluation_count) || 0,
        total_score: totalScore,
        average_score: averageScore
      };
    }));

    // Sort by average score DESC
    teams.sort((a, b) => b.average_score - a.average_score);

    res.json(teams);
  } catch (error) {
    console.error('Error in /teams:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get results
router.get('/results', authenticate, authorize(['admin']), async (req, res) => {
  try {
    // Calculate averages - first get judge totals, then average them
    const results = await pool.query(`
      SELECT
        t.id,
        u.name,
        t.hall,
        AVG(judge_total) as average_score
      FROM (
        SELECT
          t.id,
          e.judge_id,
          SUM(es.score * c.weight / 100) as judge_total
        FROM teams t
        JOIN evaluations e ON t.id = e.team_id
        JOIN evaluation_scores es ON e.id = es.evaluation_id
        JOIN criteria c ON es.criterion_key = c.key
        GROUP BY t.id, e.judge_id
      ) judge_scores
      JOIN teams t ON judge_scores.id = t.id
      JOIN users u ON t.user_id = u.id
      GROUP BY t.id, u.name, t.hall
      ORDER BY average_score DESC
    `);

    res.json(results.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get team details with all evaluations
router.get('/teams/:teamId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { teamId } = req.params;

    // Get team info
    const teamResult = await pool.query(`
      SELECT t.id, u.name, t.hall, p.submitted_at
      FROM teams t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.id = p.team_id
      WHERE t.id = $1
    `, [teamId]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const team = teamResult.rows[0];

    // Get all evaluations for this team
    const evaluationsResult = await pool.query(`
      SELECT
        j.id as judge_id,
        ju.name as judge_name,
        j.hall as judge_hall,
        e.id as evaluation_id,
        SUM(es.score * c.weight / 100) as total_score
      FROM judges j
      JOIN users ju ON j.user_id = ju.id
      LEFT JOIN evaluations e ON j.id = e.judge_id AND e.team_id = $1
      LEFT JOIN evaluation_scores es ON e.id = es.evaluation_id
      LEFT JOIN criteria c ON es.criterion_key = c.key
      WHERE j.hall = $2
      GROUP BY j.id, ju.name, j.hall, e.id
      ORDER BY ju.name
    `, [teamId, team.hall]);

    // Get detailed scores for each criterion
    const detailedScoresResult = await pool.query(`
      SELECT
        ju.name as judge_name,
        c.name as criterion_name,
        es.score,
        c.weight
      FROM judges j
      JOIN users ju ON j.user_id = ju.id
      LEFT JOIN evaluations e ON j.id = e.judge_id AND e.team_id = $1
      LEFT JOIN evaluation_scores es ON e.id = es.evaluation_id
      LEFT JOIN criteria c ON es.criterion_key = c.key
      WHERE j.hall = $2
      ORDER BY ju.name, c.name
    `, [teamId, team.hall]);

    res.json({
      team,
      evaluations: evaluationsResult.rows,
      detailedScores: detailedScoresResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get final results
router.get('/results', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const results = await pool.query(`
      SELECT
        t.id,
        u.name,
        t.hall,
        AVG(es.score * c.weight / 100) as average_score
      FROM teams t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN evaluations e ON t.id = e.team_id
      LEFT JOIN evaluation_scores es ON e.id = es.evaluation_id
      LEFT JOIN criteria c ON es.criterion_key = c.key
      WHERE es.score IS NOT NULL
      GROUP BY t.id, u.name, t.hall
      ORDER BY average_score DESC
    `);

    res.json(results.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed statistics
router.get('/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM teams) as total_teams,
        (SELECT COUNT(DISTINCT t.id) FROM teams t JOIN projects p ON t.id = p.team_id) as submitted_teams,
        (SELECT COUNT(DISTINCT team_id) FROM evaluations) as evaluated_teams,
        (SELECT COUNT(*) FROM judges) as total_judges,
        (SELECT AVG(score) FROM evaluation_scores) as average_score
    `);

    const hallStats = await pool.query(`
      SELECT
        hall,
        COUNT(*) as teams_count,
        COUNT(CASE WHEN p.submitted_at IS NOT NULL THEN 1 END) as submitted_count,
        COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN t.id END) as evaluated_count
      FROM teams t
      LEFT JOIN projects p ON t.id = p.team_id
      LEFT JOIN evaluations e ON t.id = e.team_id
      GROUP BY hall
      ORDER BY hall
    `);

    res.json({
      overall: stats.rows[0],
      byHall: hallStats.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;