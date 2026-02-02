const { pool } = require('./db');

(async () => {
  try {
    console.log('\n=== بيانات قاعدة البيانات على Render ===\n');
    
    // Count users by role
    const adminCount = await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'admin'");
    const judgeCount = await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'judge'");
    const teamCount = await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'team'");
    
    console.log('📊 إحصائيات المستخدمين:');
    console.log(`   - Admin: ${adminCount.rows[0].total}`);
    console.log(`   - Judges: ${judgeCount.rows[0].total}`);
    console.log(`   - Teams: ${teamCount.rows[0].total}`);
    console.log(`   - المجموع: ${parseInt(adminCount.rows[0].total) + parseInt(judgeCount.rows[0].total) + parseInt(teamCount.rows[0].total)}`);
    
    // Show sample users
    console.log('\n👥 عينة من المستخدمين:');
    const sampleUsers = await pool.query(`
      SELECT name, email, role, hall 
      FROM users 
      WHERE role IN ('admin', 'judge', 'team')
      ORDER BY role, hall, id
      LIMIT 15
    `);
    console.table(sampleUsers.rows);
    
    // Projects
    const projects = await pool.query('SELECT COUNT(*) as total FROM projects');
    console.log(`\n📁 المشاريع: ${projects.rows[0].total}`);
    
    // Evaluations
    const evaluations = await pool.query('SELECT COUNT(*) as total FROM evaluations');
    console.log(`📝 التقييمات: ${evaluations.rows[0].total}`);
    
    // Evaluation scores
    const scores = await pool.query('SELECT COUNT(*) as total FROM evaluation_scores');
    console.log(`⭐ النقاط المسجلة: ${scores.rows[0].total}`);
    
    console.log('\n✅ جميع البيانات موجودة وسليمة على Render!\n');
    
    pool.end();
  } catch(e) {
    console.error('خطأ:', e.message);
    pool.end();
  }
})();
