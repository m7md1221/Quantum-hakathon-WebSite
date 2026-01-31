const express = require('express');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { pool } = require('../db');

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
        u.institution_name,
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
      GROUP BY t.id, u.team_number, u.name, u.institution_name, t.hall
      ORDER BY average_score DESC
    `);

    res.json(resultsResult.rows);
  } catch (error) {
    console.error('Error in /results:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get project GitHub URL by teamId (Admin version)
router.get('/projects/:teamId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const teamId = req.params.teamId;
    const result = await pool.query(
      'SELECT github_repo_url, clean_code_score, eslint_error_count, eslint_warning_count, clean_code_status, clean_code_failure_reason, last_evaluated_at FROM projects WHERE team_id = $1',
      [teamId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const row = result.rows[0];

    res.json({ 
      github_url: row.github_repo_url,
      clean_code_score: row.clean_code_score,
      eslint_error_count: row.eslint_error_count,
      eslint_warning_count: row.eslint_warning_count,
      clean_code_status: row.clean_code_status,
      clean_code_failure_reason: row.clean_code_failure_reason,
      last_evaluated_at: row.last_evaluated_at,
      status: 'success'
    });
  } catch (error) {
    console.error('Error fetching project URL:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Trigger clean code evaluation for a given team (Admin only)
const { processRepoForTeam } = require('../services/cleanCode');

router.post('/projects/:teamId/clean-code', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { teamId } = req.params;
    const proj = await pool.query('SELECT github_repo_url FROM projects WHERE team_id = $1', [teamId]);
    if (proj.rows.length === 0) return res.status(404).json({ message: 'Project not found' });

    const repoUrl = proj.rows[0].github_repo_url;
    if (!repoUrl) return res.status(400).json({ message: 'No repository URL submitted' });

    // Trigger processing (do not block long-running ops)
    (async () => {
      try {
        await processRepoForTeam(teamId, repoUrl);
      } catch (err) {
        console.error('Manual clean code processing failed for team', teamId, err.message);
      }
    })();

    res.json({ message: 'Clean code evaluation triggered' });
  } catch (error) {
    console.error('Error triggering clean code evaluation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get clean code evaluation result for a team (Admin)
router.get('/projects/:teamId/clean-code', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { teamId } = req.params;
    const result = await pool.query(
      'SELECT clean_code_score, eslint_error_count, eslint_warning_count, clean_code_status, clean_code_failure_reason, clean_code_report, last_evaluated_at FROM projects WHERE team_id = $1',
      [teamId]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Project not found' });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching clean code result:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Get team details with all evaluations
router.get('/teams/:teamId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { teamId } = req.params;

    // Get team info
    const teamResult = await pool.query(`
      SELECT t.id, u.name, u.team_number, u.institution_name, t.hall, p.submitted_at, p.github_repo_url, p.clean_code_score, p.eslint_error_count, p.eslint_warning_count, p.clean_code_status, p.clean_code_failure_reason, p.last_evaluated_at
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
        COUNT(DISTINCT t.id) as teams_count,
        COUNT(DISTINCT p.team_id) as submitted_count,
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
        u.institution_name,
        j.hall,
        COUNT(e.id) as evaluation_count
      FROM judges j
      JOIN users u ON j.user_id = u.id
      LEFT JOIN evaluations e ON j.id = e.judge_id
      GROUP BY j.id, u.name, u.institution_name, j.hall
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

// Update evaluation score for a criterion (Admin only)
router.put('/evaluation-scores/:scoreId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { scoreId } = req.params;
    const { score, adminNote } = req.body;

    // Validate input
    if (!scoreId || isNaN(parseInt(scoreId))) {
      return res.status(400).json({ message: 'Invalid score ID' });
    }

    if (score === undefined || isNaN(parseFloat(score))) {
      return res.status(400).json({ message: 'Invalid score value' });
    }

    const numScore = parseFloat(score);

    // Check if score exists and get criterion max_score
    const scoreCheck = await pool.query(
      `SELECT es.id, es.evaluation_id, c.max_score
       FROM evaluation_scores es
       JOIN criteria c ON es.criterion_key = c.key
       WHERE es.id = $1`,
      [parseInt(scoreId)]
    );

    if (scoreCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Score not found' });
    }

    const maxScore = parseFloat(scoreCheck.rows[0].max_score) || 10;
    if (numScore < 0 || numScore > maxScore) {
      return res.status(400).json({ message: `Score must be between 0 and ${maxScore}` });
    }

    const evaluationId = scoreCheck.rows[0].evaluation_id;

    // Update the score with admin note
    const note = adminNote ? `تم التعديل من الادمن: ${adminNote}` : 'تم التعديل من الادمن';
    const updateResult = await pool.query(
      `UPDATE evaluation_scores 
       SET score = $1, admin_note = $2
       WHERE id = $3 
       RETURNING *`,
      [numScore, note, parseInt(scoreId)]
    );

    // Get the updated evaluation scores to recalculate average
    const updatedScoresResult = await pool.query(
      `SELECT 
        es.id,
        es.criterion_key,
        es.score,
        c.weight
      FROM evaluation_scores es
      JOIN criteria c ON es.criterion_key = c.key
      WHERE es.evaluation_id = $1`,
      [evaluationId]
    );

    // Calculate new total for this evaluation
    let totalScore = 0;
    if (updatedScoresResult.rows.length > 0) {
      totalScore = updatedScoresResult.rows.reduce((sum, row) => {
        return sum + (parseFloat(row.score) * parseFloat(row.weight) / 100);
      }, 0);
    }

    res.json({
      message: 'Score updated successfully',
      score: updateResult.rows[0],
      newTotalForEvaluation: totalScore
    });
  } catch (error) {
    console.error('Error updating evaluation score:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// Get team details with evaluations (for admin to edit scores)
router.get('/team-evaluations/:teamId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { teamId } = req.params;

    // Get team info
    const teamResult = await pool.query(
      `SELECT t.id, u.name, u.team_number, t.hall 
       FROM teams t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const team = teamResult.rows[0];

    // Get all evaluations with their total scores
    const evaluationsWithTotals = await pool.query(
      `SELECT
        e.id as evaluation_id,
        j.id as judge_id,
        ju.name as judge_name,
        j.hall as judge_hall,
        COALESCE(SUM(es.score * c.weight / c.max_score), 0) as total_score
      FROM evaluations e
      JOIN judges j ON e.judge_id = j.id
      JOIN users ju ON j.user_id = ju.id
      LEFT JOIN evaluation_scores es ON e.id = es.evaluation_id
      LEFT JOIN criteria c ON es.criterion_key = c.key
      WHERE e.team_id = $1
      GROUP BY e.id, j.id, ju.name, j.hall
      ORDER BY ju.name`,
      [teamId]
    );

    // Get all evaluation scores details
    const evaluationsResult = await pool.query(
      `SELECT
        e.id as evaluation_id,
        j.id as judge_id,
        ju.name as judge_name,
        j.hall as judge_hall,
        es.id as score_id,
        es.criterion_key,
        c.name as criterion_name,
        es.score,
        c.weight,
        c.max_score,
        es.admin_note
      FROM evaluations e
      JOIN judges j ON e.judge_id = j.id
      JOIN users ju ON j.user_id = ju.id
      LEFT JOIN evaluation_scores es ON e.id = es.evaluation_id
      LEFT JOIN criteria c ON es.criterion_key = c.key
      WHERE e.team_id = $1
      ORDER BY ju.name, c.name`,
      [teamId]
    );

    // Group by evaluation and judge with total scores
    const evaluationsByJudge = {};
    
    // First, create map of evaluation totals
    const evaluationTotals = {};
    evaluationsWithTotals.rows.forEach(row => {
      evaluationTotals[row.evaluation_id] = parseFloat(row.total_score || 0);
    });
    
    evaluationsResult.rows.forEach(row => {
      const key = `${row.evaluation_id}-${row.judge_id}`;
      if (!evaluationsByJudge[key]) {
        evaluationsByJudge[key] = {
          evaluation_id: row.evaluation_id,
          judge_id: row.judge_id,
          judge_name: row.judge_name,
          judge_hall: row.judge_hall,
          total_score: evaluationTotals[row.evaluation_id] || 0,
          scores: []
        };
      }
      if (row.score_id) {
        evaluationsByJudge[key].scores.push({
          score_id: row.score_id,
          criterion_key: row.criterion_key,
          criterion_name: row.criterion_name,
          score: row.score,
          weight: row.weight,
          max_score: row.max_score,
          admin_note: row.admin_note
        });
      }
    });

    res.json({
      team,
      evaluations: Object.values(evaluationsByJudge)
    });
  } catch (error) {
    console.error('Error fetching team evaluations:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;