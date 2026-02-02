const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const ExcelJS = require('exceljs');
const fs = require('fs');

// Generate strong random password
function generateRandomPassword() {
  const length = 12;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function generateAndUpdatePasswords() {
  try {
    console.log('🔄 جاري جلب جميع المستخدمين من قاعدة البيانات...\n');

    // Get all users
    const result = await pool.query('SELECT id, name, email, role, hall FROM users ORDER BY role, id');
    const users = result.rows;

    if (users.length === 0) {
      console.log('❌ لم يتم العثور على مستخدمين');
      pool.end();
      return;
    }

    console.log(`✅ تم العثور على ${users.length} مستخدم\n`);

    // Generate new passwords and prepare update queries
    const userCredentials = [];
    
    for (const user of users) {
      const newPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password in database
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
      
      userCredentials.push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hall: user.hall || 'N/A',
        password: newPassword
      });
    }

    console.log('✅ تم تحديث جميع كلمات السر في قاعدة البيانات\n');

    // Create Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('User Credentials');

    // Add header row with styling
    const headerRow = worksheet.addRow(['#', 'الاسم', 'البريد الإلكتروني', 'الدور', 'القاعة', 'كلمة السر']);
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A235A' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center' };

    // Add data rows
    userCredentials.forEach((user, index) => {
      const row = worksheet.addRow([
        index + 1,
        user.name,
        user.email,
        user.role,
        user.hall,
        user.password
      ]);
      
      // Add alternating row colors
      if (index % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FC' } };
      }
      
      row.alignment = { horizontal: 'center', vertical: 'center' };
    });

    // Adjust column widths
    worksheet.columns = [
      { width: 5 },
      { width: 20 },
      { width: 25 },
      { width: 12 },
      { width: 10 },
      { width: 18 }
    ];

    // Save Excel file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `User_Credentials_${timestamp}.xlsx`;
    await workbook.xlsx.writeFile(filename);

    console.log(`✅ تم إنشاء ملف Excel: ${filename}\n`);

    // Print summary to console
    console.log('=' .repeat(80));
    console.log('📊 ملخص بيانات المستخدمين والكلمات السرية الجديدة');
    console.log('=' .repeat(80) + '\n');

    // Group by role
    const grouped = {
      admin: userCredentials.filter(u => u.role === 'admin'),
      judge: userCredentials.filter(u => u.role === 'judge'),
      team: userCredentials.filter(u => u.role === 'team')
    };

    // Print Admin
    if (grouped.admin.length > 0) {
      console.log('👨‍💼 المسؤولون (ADMIN):');
      console.log('-' .repeat(80));
      grouped.admin.forEach((user, idx) => {
        console.log(`${idx + 1}. الاسم: ${user.name}`);
        console.log(`   البريد: ${user.email}`);
        console.log(`   كلمة السر: ${user.password}\n`);
      });
    }

    // Print Judges
    if (grouped.judge.length > 0) {
      console.log('⚖️ القضاة (JUDGES):');
      console.log('-' .repeat(80));
      grouped.judge.forEach((user, idx) => {
        console.log(`${idx + 1}. الاسم: ${user.name}`);
        console.log(`   البريد: ${user.email}`);
        console.log(`   القاعة: ${user.hall}`);
        console.log(`   كلمة السر: ${user.password}\n`);
      });
    }

    // Print Teams
    if (grouped.team.length > 0) {
      console.log('👥 الفرق (TEAMS):');
      console.log('-' .repeat(80));
      grouped.team.forEach((user, idx) => {
        console.log(`${idx + 1}. الاسم: ${user.name}`);
        console.log(`   البريد: ${user.email}`);
        console.log(`   القاعة: ${user.hall}`);
        console.log(`   كلمة السر: ${user.password}\n`);
      });
    }

    console.log('=' .repeat(80));
    console.log(`✅ تم معالجة ${userCredentials.length} مستخدم بنجاح`);
    console.log(`📁 الملف محفوظ في: ${process.cwd()}/${filename}`);
    console.log('=' .repeat(80) + '\n');

  } catch (error) {
    console.error('❌ خطأ:', error.message);
  } finally {
    pool.end();
  }
}

generateAndUpdatePasswords();
