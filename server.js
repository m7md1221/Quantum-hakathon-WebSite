const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');
const judgeRoutes = require('./routes/judge');
const adminRoutes = require('./routes/admin');
const { pool } = require('./db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware to log all API requests
app.use('/api', (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes - MUST come before static files
app.use('/api/auth', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/judge', judgeRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler for API routes (before static files)
app.use('/api', (req, res) => {
  console.error(`[404] ${req.method} ${req.path} - Route not found`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path
  });
});

// Static files - MUST come after API routes
app.use(express.static(path.join(__dirname, 'public')));

// Debug: Log all registered routes
console.log('\n=== Registered Admin Routes ===');
adminRoutes.stack.forEach((r) => {
  if (r.route && r.route.path) {
    const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(', ');
    console.log(`  ${methods.padEnd(10)} /api/admin${r.route.path}`);
  } else if (r.name === 'router') {
    // Handle nested routers
    console.log(`  [Router] ${r.regexp}`);
  }
});
console.log('================================\n');

console.log('\n=== Registered Judge Routes ===');
judgeRoutes.stack.forEach((r) => {
  if (r.route && r.route.path) {
    const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(', ');
    console.log(`  ${methods.padEnd(10)} /api/judge${r.route.path}`);
  } else if (r.name === 'router') {
    // Handle nested routers
    console.log(`  [Router] ${r.regexp}`);
  }
});
console.log('================================\n');

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);

  // Handle Multer errors specifically if needed
  if (err instanceof require('multer').MulterError) {
    return res.status(400).json({ message: 'File upload error: ' + err.message });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Quantum Hackathon Server Started [UPDATED VERSION - route /finalize-evaluation active]');
});