const { pool } = require('./db');

(async () => {
  try {
    // Check users
    const users = await pool.query('SELECT id, name, email, role, hall FROM users ORDER BY id LIMIT 10');
    console.log('المستخدمين الموجودين حالياً:');
    console.table(users.rows);
    
    const count = await pool.query('SELECT COUNT(*) as total FROM users');
    console.log(`\nإجمالي المستخدمين: ${count.rows[0].total}`);
    
    // Check if there's any project data
    const projects = await pool.query('SELECT COUNT(*) as total FROM projects');
    console.log(`إجمالي المشاريع: ${projects.rows[0].total}`);
    
    // Check evaluations
    const evaluations = await pool.query('SELECT COUNT(*) as total FROM evaluations');
    console.log(`إجمالي التقييمات: ${evaluations.rows[0].total}`);
    
    pool.end();
  } catch(e) {
    console.error('خطأ:', e.message);
    pool.end();
  }
})();
