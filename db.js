const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // تحسينات الـ Performance - محسّن للمزيد من المستخدمين
  max: 50,                          // حد أقصى اتصالات (زيادة من 20 إلى 50)
  min: 5,                           // حد أدنى من الاتصالات الجاهزة
  idleTimeoutMillis: 60000,         // إغلاق اتصال خامل بعد 60 ثانية
  connectionTimeoutMillis: 5000,    // انتظر 5 ثوانٍ للاتصال
  statement_timeout: 30000,         // timeout للـ queries
  query_timeout: 30000,
  allowExitOnIdle: false            // لا تغلق الـ pool عند عدم الاستخدام
});

// معالجة الأخطاء
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
});

pool.on('connect', () => {
  console.log('✅ New database connection');
});

module.exports = { pool };
