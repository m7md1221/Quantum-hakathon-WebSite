const os = require('os');
const { pool } = require('./db');

// Monitor system resources
async function getSystemMetrics() {
  try {
    // احصل على معلومات الـ pool
    const poolInfo = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    };
    
    return {
      timestamp: new Date(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        max: Math.round(os.totalmem() / 1024 / 1024),
        percentUsed: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
      },
      database: poolInfo,
      uptime: Math.round(process.uptime()),
      cpuUsage: process.cpuUsage(),
      loadAverage: os.loadavg()
    };
  } catch (err) {
    return {
      timestamp: new Date(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        max: Math.round(os.totalmem() / 1024 / 1024)
      },
      uptime: Math.round(process.uptime()),
      error: 'Could not fetch all metrics'
    };
  }
}

// Health check endpoint
async function healthCheck() {
  try {
    // Test database
    const result = await pool.query('SELECT NOW()');
    const metrics = await getSystemMetrics();
    
    // تحقق من الصحة العامة
    const warnings = [];
    if (metrics.memory && metrics.memory.percentUsed > 85) {
      warnings.push('ذاكرة عالية: ' + metrics.memory.percentUsed + '%');
    }
    if (metrics.database && metrics.database.waiting > 5) {
      warnings.push('طلبات قاعدة بيانات منتظرة: ' + metrics.database.waiting);
    }
    
    return {
      status: warnings.length > 0 ? 'warning' : 'ok',
      database: 'connected',
      timestamp: result.rows[0],
      metrics: metrics,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (err) {
    return {
      status: 'error',
      database: 'disconnected',
      error: err.message,
      metrics: await getSystemMetrics()
    };
  }
}

// Alert if memory usage is too high
function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const percentUsed = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (percentUsed > 90) {
    console.error(`⚠️ HIGH MEMORY WARNING: ${percentUsed.toFixed(2)}%`);
    return false;
  }
  return true;
}

module.exports = { getSystemMetrics, healthCheck, checkMemoryUsage };
