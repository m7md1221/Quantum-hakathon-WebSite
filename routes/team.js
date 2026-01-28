const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { pool } = require('../db');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

require('dotenv').config(); // مهم جدًا على Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'quantum_projects',
    resource_type: 'raw', // <--- مهم جدًا لرفع ملفات ZIP
    public_id: (req, file) => Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'),
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Upload project
router.post('/upload', authenticate, authorize(['team']), upload.single('project'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log("File upload info:", req.file);
    const fileUrl = req.file.path;

    // Get the actual team ID (NOT user ID)
    const teamResult = await pool.query('SELECT id FROM teams WHERE user_id = $1', [req.user.id]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: 'Team record not found for this user' });
    }

    const teamId = teamResult.rows[0].id;
    const publicId = req.file.filename; // Cloudinary storage provides public_id in filename

    // Save to DB with UPSERT logic (using team_id as the unique key)
    await pool.query(`
      INSERT INTO projects (team_id, file_path, public_id) 
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id) DO UPDATE SET 
        file_path = EXCLUDED.file_path, 
        public_id = EXCLUDED.public_id,
        submitted_at = NOW()
    `, [teamId, fileUrl, publicId]);

    res.json({ message: 'Project uploaded successfully', fileUrl });
  } catch (error) {
    console.error("Upload error details:", error);
    res.status(500).json({
      message: 'Upload failed: ' + (error.message || 'Server error'),
      error: error.message
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
