const express = require('express');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { pool } = require('../db');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // <--- Ensures all URLs are HTTPS
});

const router = express.Router();

// Test route to verify router is working
router.delete('/test-delete', (req, res) => {
  console.log('Test DELETE route called');
  res.json({ message: 'DELETE route is working' });
});

// Get all teams with scores
router.get('/teams', authenticate, authorize(['admin']), async (req, res) => {
  try {
    // First get basic team info
    const teamsResult = await pool.query(`
      SELECT
        t.id,
        u.team_number,
        u.name,
        t.hall,
        p.submitted_at,
        (SELECT COUNT(*) FROM evaluations WHERE team_id = t.id) as evaluation_count
      FROM teams t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN projects p ON t.id = p.team_id
       GROUP BY t.id, u.team_number, t.hall, p.submitted_at , u.name
    `);

    // For each team, calculate scores
    const teams = await Promise.all(teamsResult.rows.map(async (team) => {
      const teamId = parseInt(team.id);

      // Get judge totals for this team
      const judgeScoresResult = await pool.query(`
        SELECT 
          e.judge_id,
          SUM(es.score * c.weight / c.max_score) as judge_total
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
        team_number: team.team_number,
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
// Get results (average of judge's total scores)
router.get('/results', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const resultsResult = await pool.query(`
      SELECT
        t.id,
        u.team_number,
        u.name,
        t.hall,
        AVG(judge_total) as average_score
      FROM (
        SELECT
          t.id,
          e.judge_id,
          SUM(es.score * c.weight / c.max_score) as judge_total
        FROM teams t
        JOIN evaluations e ON t.id = e.team_id
        JOIN evaluation_scores es ON e.id = es.evaluation_id
        JOIN criteria c ON es.criterion_key = c.key
        GROUP BY t.id, e.judge_id
      ) judge_scores
      JOIN teams t ON judge_scores.id = t.id
      JOIN users u ON t.user_id = u.id
      GROUP BY t.id, u.team_number, u.name, t.hall
      ORDER BY average_score DESC
    `);

    res.json(resultsResult.rows);
  } catch (error) {
    console.error('Error in /results:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Download project file by teamId (Admin version)
router.get('/projects/:teamId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const result = await pool.query(
      'SELECT file_path FROM projects WHERE team_id = $1',
      [teamId]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Project not found' });

    const filePath = result.rows[0].file_path;

    // Extract public_id from Cloudinary URL and sign it
    try {
      if (!filePath.includes('/upload/')) {
        return res.status(400).json({
          message: 'This project file (local path) was not successfully uploaded to Cloudinary. Please ask the team to re-upload.'
        });
      }

      const uploadPart = filePath.split('/upload/')[1];
      const parts = uploadPart.split('/');
      // Skip version (v123/) if it exists
      const publicId = (parts[0].startsWith('v') && parts.length > 1)
        ? parts.slice(1).join('/')
        : uploadPart;

      const signedUrl = cloudinary.url(publicId, {
        sign_url: true,
        resource_type: 'raw',
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour
      });

      return res.json({ signedUrl });
    } catch (err) {
      console.error('Signed URL Error:', err);
      res.status(400).json({ message: 'Error generating secure download link: ' + err.message });
    }
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
      SELECT t.id, u.name, u.team_number, t.hall, p.submitted_at
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
        COALESCE(SUM(es.score * c.weight / c.max_score), 0) as total_score
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
        c.weight::FLOAT as weight,
        c.max_score::FLOAT as max_score
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

// Get detailed statistics
router.get('/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM teams) as total_teams,
        (SELECT COUNT(DISTINCT t.id) FROM teams t JOIN projects p ON t.id = p.team_id) as submitted_teams,
        (SELECT COUNT(DISTINCT team_id) FROM evaluations) as evaluated_teams,
        (SELECT COUNT(*) FROM judges) as total_judges,
        (SELECT AVG(total) FROM (
          SELECT SUM(es.score * c.weight / c.max_score) as total 
          FROM evaluation_scores es
          JOIN criteria c ON es.criterion_key = c.key
          GROUP BY es.evaluation_id
        ) as team_totals) as average_score
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

// Get all judges with their evaluation counts
router.get('/judges', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const judgesResult = await pool.query(`
      SELECT
        j.id,
        u.name,
        j.hall,
        COUNT(e.id) as evaluation_count
      FROM judges j
      JOIN users u ON j.user_id = u.id
      LEFT JOIN evaluations e ON j.id = e.judge_id
      GROUP BY j.id, u.name, j.hall
      ORDER BY j.hall, u.name
    `);

    res.json(judgesResult.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete evaluation from a specific team
router.delete('/evaluations/:evaluationId', authenticate, authorize(['admin']), async (req, res) => {
  console.log('=== DELETE /evaluations/:evaluationId ROUTE CALLED ===');
  console.log('Request params:', req.params);
  console.log('Request method:', req.method);
  console.log('Request url:', req.url);

  try {
    const { evaluationId } = req.params;
    console.log('DELETE /evaluations/:evaluationId called with:', { evaluationId, user: req.user });

    if (!evaluationId || isNaN(parseInt(evaluationId))) {
      console.log('Invalid evaluation ID:', evaluationId);
      return res.status(400).json({ message: 'Invalid evaluation ID' });
    }

    const evalId = parseInt(evaluationId);
    console.log('Parsed evaluation ID:', evalId);

    // Check if evaluation exists
    const evalCheck = await pool.query('SELECT id, judge_id, team_id FROM evaluations WHERE id = $1', [evalId]);
    console.log('Evaluation check result:', evalCheck.rows);

    if (evalCheck.rows.length === 0) {
      console.log('Evaluation not found:', evalId);
      return res.status(404).json({ message: 'Evaluation not found' });
    }

    console.log('Deleting evaluation:', evalId);
    console.log('Evaluation details:', evalCheck.rows[0]);

    // Delete evaluation (cascade will delete evaluation_scores)
    const deleteResult = await pool.query('DELETE FROM evaluations WHERE id = $1 RETURNING id', [evalId]);
    console.log('Delete result:', deleteResult.rows);
    console.log('Evaluation deleted successfully:', evalId);

    res.json({
      message: 'Evaluation deleted successfully',
      deletedId: evalId
    });
  } catch (error) {
    console.error('Error deleting evaluation:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error: ' + (error.message || 'Unknown error') });
  }
});

// Delete all evaluations from a specific judge
router.delete('/judges/:judgeId/evaluations', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { judgeId } = req.params;

    if (!judgeId || isNaN(parseInt(judgeId))) {
      return res.status(400).json({ message: 'Invalid judge ID' });
    }

    // Check if judge exists
    const judgeCheck = await pool.query('SELECT id FROM judges WHERE id = $1', [judgeId]);
    if (judgeCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Judge not found' });
    }

    // Get count before deletion
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM evaluations WHERE judge_id = $1',
      [judgeId]
    );
    const deletedCount = parseInt(countResult.rows[0].count) || 0;

    // Delete all evaluations from this judge (cascade will delete evaluation_scores)
    await pool.query('DELETE FROM evaluations WHERE judge_id = $1', [judgeId]);

    res.json({
      message: `Deleted ${deletedCount} evaluation(s) from judge`,
      deletedCount
    });
  } catch (error) {
    console.error('Error deleting judge evaluations:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;