const { Pool } = require('pg');
const fs = require('fs');

async function setupLocalDatabase() {
  // Connect to postgres database to create new database
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'postgres',
    port: 5432,
  });

  try {
    console.log('1️⃣ إنشاء قاعدة البيانات المحلية...');
    
    // Drop existing database if exists
    await pool.query('DROP DATABASE IF EXISTS quantum_khakathon');
    console.log('   ✅ تم حذف القاعدة القديمة (إن وجدت)');
    
    // Create new database
    await pool.query('CREATE DATABASE quantum_khakathon');
    console.log('   ✅ تم إنشاء قاعدة بيانات جديدة: quantum_khakathon');
    
    await pool.end();

    // Now connect to the new database and create schema
    const newPool = new Pool({
      user: 'postgres',
      host: 'localhost',
      database: 'quantum_khakathon',
      password: 'postgres',
      port: 5432,
    });

    console.log('\n2️⃣ إنشاء الجداول...');
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    await newPool.query(schema);
    console.log('   ✅ تم إنشاء جميع الجداول بنجاح');

    await newPool.end();
    
    console.log('\n✅ قاعدة البيانات المحلية جاهزة!\n');
    console.log('الآن يمكنك تشغيل: node copy_from_render_to_local.js');
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    await pool.end();
  }
}

setupLocalDatabase();
