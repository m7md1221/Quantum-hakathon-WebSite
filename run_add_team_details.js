const { pool } = require('./db');
const fs = require('fs');

async function runMigration() {
  try {
    console.log('📝 جاري إضافة الأعمدة الجديدة...\n');
    
    const migration = fs.readFileSync('./migrations/add_team_details.sql', 'utf8');
    await pool.query(migration);
    
    console.log('✅ تم إضافة الأعمدة بنجاح:');
    console.log('   - team_number (رقم الفريق)');
    console.log('   - team_institution (اسم المؤسسة)\n');
    
    // Verify the columns were added
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('team_number', 'team_institution')
    `);
    
    console.log('📊 الأعمدة المضافة:');
    console.table(result.rows);
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
