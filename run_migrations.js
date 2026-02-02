const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  try {
    console.log('🔄 جاري تشغيل الـ migrations...\n');

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      console.log(`📝 تطبيق: ${file}`);
      
      try {
        // Split by semicolon and execute each statement separately
        const statements = content
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            await pool.query(statement);
          }
        }
        
        console.log(`✅ تم: ${file}\n`);
      } catch (err) {
        console.log(`⚠️ تحذير في ${file}: ${err.message}\n`);
      }
    }

    console.log('✅ انتهت جميع الـ migrations');
    pool.end();
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
}

runMigrations();
