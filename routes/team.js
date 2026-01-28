const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { pool } = require('../db');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// إعداد Cloudinary
cloudinary.config({
  cloud_name: 'dsb7rtmcr',
  api_key: '894363245818157',
  api_secret: 'eM_Uv6D9pstT6EwMqKloXn-mFzY'
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'quantum_projects',
    format: async (req, file) => 'zip',
    public_id: (req, file) => Date.now() + '-' + file.originalname,
  },
});

const upload = multer({ storage });

// Upload project
router.post('/upload', authenticate, authorize(['team']), upload.single('project'), async (req, res) => {
  const deadline = new Date('2026-02-01T23:59:59');
  if (new Date() > deadline) {
    return res.status(400).json({ message: 'Submission deadline has passed' });
  }

  try {
    const teamResult = await pool.query('SELECT id FROM teams WHERE user_id = $1', [req.user.id]);
    if (teamResult.rows.length === 0) return res.status(404).json({ message: 'Team not found' });

    const teamId = teamResult.rows[0].id;
    const existingProject = await pool.query('SELECT id FROM projects WHERE team_id = $1', [teamId]);
    if (existingProject.rows.length > 0) return res.status(400).json({ message: 'Project already submitted' });

    const fileUrl = req.file.path; // رابط الملف على Cloudinary
    console.log("Uploaded file URL:", fileUrl);

    await pool.query('INSERT INTO projects (team_id, file_path) VALUES ($1, $2)', [teamId, fileUrl]);

    res.json({ message: 'Project uploaded successfully', fileUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
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
