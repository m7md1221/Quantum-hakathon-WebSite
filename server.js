const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/team');
const judgeRoutes = require('./routes/judge');
const adminRoutes = require('./routes/admin');
const { pool } = require('./db');
const { cacheMiddleware } = require('./cache');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Compression middleware - تقليل حجم الـ responses
app.use(require('compression')());

// Rate Limiting - حماية من الضغط الزائد
const rateLimit = {};
const RATE_LIMIT_WINDOW = 60000; // دقيقة واحدة
const MAX_REQUESTS_PER_WINDOW = 100; // 100 طلب بالدقيقة

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    return next();
  }
  
  if (now > rateLimit[ip].resetTime) {
    rateLimit[ip] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    return next();
  }
  
  if (rateLimit[ip].count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'طلبات كثيرة جداً',
      message: 'لقد تجاوزت الحد المسموح من الطلبات. الرجاء الانتظار دقيقة.',
      retryAfter: Math.ceil((rateLimit[ip].resetTime - now) / 1000)
    });
  }
  
  rateLimit[ip].count++;
  next();
});

// Request timeout - محسّن
app.use((req, res, next) => {
  req.setTimeout(45000); // 45 ثانية timeout
  res.setTimeout(45000);
  next();
});

// تنظيف rate limit cache كل 10 دقائق
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimit).forEach(ip => {
    if (now > rateLimit[ip].resetTime + 300000) { // 5 دقائق زيادة
      delete rateLimit[ip];
    }
  });
}, 600000);

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

// Health check endpoint
const { healthCheck } = require('./monitoring');
app.get('/api/health', async (req, res) => {
  const health = await healthCheck();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', time: new Date().toISOString() });
});

console.log('✅ Registered core /api routes');

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

// GLOBAL ERROR HANDLER - محسّن مع رسائل واضحة
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  
  // رسائل خطأ واضحة بالعربي
  let userMessage = 'حدث خطأ في السيرفر';
  let statusCode = err.status || 500;
  
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    userMessage = 'انتهى وقت الطلب. الرجاء المحاولة مرة أخرى.';
    statusCode = 408;
  } else if (err.code === '42P01') {
    userMessage = 'خطأ في قاعدة البيانات';
    statusCode = 500;
  } else if (err.message && err.message.includes('too many clients')) {
    userMessage = 'السيرفر مشغول حالياً. الرجاء الانتظار قليلاً والمحاولة مرة أخرى.';
    statusCode = 503;
  } else if (err.message) {
    userMessage = err.message;
  }

  res.status(statusCode).json({
    error: true,
    message: userMessage,
    code: err.code,
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Quantum Hackathon Server Started [UPDATED VERSION - route /finalize-evaluation active]');
});