const express = require('express');
const fs = require('fs');
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
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Upload project
router.post('/upload', authenticate, authorize(['team']), upload.single('project'), async (req, res) => {
  let localPath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    localPath = req.file.path;
    console.log("Team ID session:", req.user.id);
    console.log("Uploading file to Cloudinary:", req.file.originalname);

    // Explicitly upload as 'raw' to avoid '0 B storage' issues or type mismatches
    const uploadResult = await cloudinary.uploader.upload(localPath, {
      folder: 'quantum_projects',
      resource_type: 'raw',
      use_filename: true,
      unique_filename: true
    });

    console.log("Upload Success. URL:", uploadResult.secure_url);
    const fileUrl = uploadResult.secure_url;

    // Fetch team record
    const teamResult = await pool.query('SELECT id FROM teams WHERE user_id = $1', [req.user.id]);
    if (teamResult.rows.length === 0) {
      if (localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return res.status(404).json({ message: 'Team registration not found' });
    }
    const teamId = teamResult.rows[0].id;

    // Use a robust update/insert check instead of relying on ON CONFLICT
    const projectCheck = await pool.query('SELECT id FROM projects WHERE team_id = $1', [teamId]);

    if (projectCheck.rows.length > 0) {
      await pool.query(
        'UPDATE projects SET file_path = $1, submitted_at = NOW() WHERE team_id = $2',
        [fileUrl, teamId]
      );
    } else {
      await pool.query(
        'INSERT INTO projects (team_id, file_path) VALUES ($1, $2)',
        [teamId, fileUrl]
      );
    }

    // Always cleanup local file
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

    res.json({ message: 'Project uploaded successfully', fileUrl });
  } catch (error) {
    console.error("Critical Upload Error:", error);
    if (localPath && fs.existsSync(localPath)) {
      try { fs.unlinkSync(localPath); } catch (err) { }
    }
    res.status(500).json({
      message: 'Upload failed: ' + (error.message || 'Server error'),
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
