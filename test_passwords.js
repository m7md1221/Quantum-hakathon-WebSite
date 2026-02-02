const bcrypt = require('bcryptjs');
const { pool } = require('./db');

(async () => {
  try {
    // Get a sample user
    const result = await pool.query('SELECT email, password FROM users WHERE email = $1', ['admin@khakathon.com']);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // Test old password
      const isOldPassword = await bcrypt.compare('password123', user.password);
      
      // Test new password
      const isNewPassword = await bcrypt.compare('Admin_admin_1', user.password);
      
      console.log('\n=== فحص كلمات المرور على Render ===');
      console.log(`البريد الإلكتروني: ${user.email}`);
      console.log(`كلمة المرور القديمة (password123): ${isOldPassword ? '✅ تعمل' : '❌ لا تعمل'}`);
      console.log(`كلمة المرور الجديدة (Admin_admin_1): ${isNewPassword ? '✅ تعمل' : '❌ لا تعمل'}`);
      
      if (isNewPassword) {
        console.log('\n✅ البيانات الجديدة موجودة على Render (كلمات المرور الفريدة)');
      } else if (isOldPassword) {
        console.log('\n⚠️ البيانات القديمة لا تزال موجودة (كلمة مرور واحدة للجميع)');
      }
    }
    
    pool.end();
  } catch(e) {
    console.error('خطأ:', e.message);
    pool.end();
  }
})();
