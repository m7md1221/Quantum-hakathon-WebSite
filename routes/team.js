const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { pool } = require('../db');

const router = express.Router();

// GitHub URL Validation Function
function validateGitHubUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  
  // Must start with https://github.com/
  if (!trimmed.startsWith('https://github.com/')) return false;
  
  // Basic URL validation - check if it's a valid GitHub URL
  try {
    const urlObj = new URL(trimmed);
    if (urlObj.hostname !== 'github.com') return false;
    if (urlObj.pathname.length <= 1) return false; // Must have owner/repo
    return true;
  } catch {
    return false;
  }
}

// GitHub URL Sanitization Function (remove trailing slashes, etc)
function sanitizeGitHubUrl(url) {
  const trimmed = url.trim();
  // Remove trailing slash if present
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

// Submit GitHub Repository URL
router.post('/submit', authenticate, authorize(['team']), async (req, res) => {
  try {
    const { github_url } = req.body;

    // Validate input
    if (!github_url) {
      return res.status(400).json({ message: 'GitHub URL is required' });
    }

    if (!validateGitHubUrl(github_url)) {
      return res.status(400).json({ 
        message: 'Invalid GitHub URL. Must start with https://github.com/' 
      });
    }

    const sanitizedUrl = sanitizeGitHubUrl(github_url);

    // Get team record
    const teamResult = await pool.query('SELECT id FROM teams WHERE user_id = $1', [req.user.id]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: 'Team registration not found' });
    }
    const teamId = teamResult.rows[0].id;

    // Check if project already submitted
    const projectCheck = await pool.query('SELECT id FROM projects WHERE team_id = $1', [teamId]);

    if (projectCheck.rows.length > 0) {
      // Update existing submission
      await pool.query(
        'UPDATE projects SET github_url = $1, submitted_at = NOW() WHERE team_id = $2',
        [sanitizedUrl, teamId]
      );
    } else {
      // Insert new submission
      await pool.query(
        'INSERT INTO projects (team_id, github_url) VALUES ($1, $2)',
        [teamId, sanitizedUrl]
      );
    }

    console.log(`[Team ${teamId}] Submitted GitHub URL: ${sanitizedUrl}`);
    res.json({ 
      message: 'Project submitted successfully',
      github_url: sanitizedUrl 
    });
  } catch (error) {
    console.error("Critical Submit Error:", error);
    res.status(500).json({
      message: 'Submission failed: ' + (error.message || 'Server error'),
      details: error.message
    });
  }
});


// Get team status
router.get('/status', authenticate, authorize(['team']), async (req, res) => {
  try {
    const teamResult = await pool.query('SELECT hall FROM teams WHERE user_id = $1', [req.user.id]);
    if (teamResult.rows.length === 0) return res.status(404).json({ message: 'Team not found' });

    const hall = teamResult.rows[0].hall;
    const projectResult = await pool.query('SELECT submitted_at FROM projects WHERE team_id = (SELECT id FROM teams WHERE user_id = $1)', [req.user.id]);

    res.json({
      hall,
      submitted: projectResult.rows.length > 0,
      submittedAt: projectResult.rows[0]?.submitted_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
