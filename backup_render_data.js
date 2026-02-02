const { Pool } = require('pg');
const fs = require('fs');

// Render database connection
const pool = new Pool({
  connectionString: 'postgresql://database_quntam_hakhathon_user:sB6lGb9ahfGrGDU9ePz2BsT9j22mfW6Q@dpg-d5r8qnffte5s73c5t4ug-a.oregon-postgres.render.com:5432/database_quntam_hakhathon?sslmode=require'
});

async function createBackup() {
  try {
    console.log('📥 جاري سحب جميع البيانات من Render...\n');

    let sqlContent = '-- Backup من Render Database\n';
    sqlContent += `-- تاريخ: ${new Date().toISOString()}\n\n`;

    // 1. Users
    console.log('1️⃣ جاري سحب المستخدمين...');
    const users = await pool.query('SELECT * FROM users ORDER BY id');
    sqlContent += '-- Users\n';
    for (const user of users.rows) {
      const name = user.name.replace(/'/g, "''");
      const email = user.email.replace(/'/g, "''");
      const password = user.password.replace(/'/g, "''");
      const hall = user.hall ? `'${user.hall}'` : 'NULL';
      sqlContent += `INSERT INTO users (id, name, email, password, role, hall) VALUES (${user.id}, '${name}', '${email}', '${password}', '${user.role}', ${hall});\n`;
    }
    console.log(`   ✅ تم سحب ${users.rows.length} مستخدم`);

    // 2. Judges
    console.log('2️⃣ جاري سحب الحكام...');
    const judges = await pool.query('SELECT * FROM judges ORDER BY id');
    sqlContent += '\n-- Judges\n';
    for (const judge of judges.rows) {
      sqlContent += `INSERT INTO judges (id, user_id, hall) VALUES (${judge.id}, ${judge.user_id}, '${judge.hall}');\n`;
    }
    console.log(`   ✅ تم سحب ${judges.rows.length} حكم`);

    // 3. Teams
    console.log('3️⃣ جاري سحب الفرق...');
    const teams = await pool.query('SELECT * FROM teams ORDER BY id');
    sqlContent += '\n-- Teams\n';
    for (const team of teams.rows) {
      sqlContent += `INSERT INTO teams (id, user_id, hall) VALUES (${team.id}, ${team.user_id}, '${team.hall}');\n`;
    }
    console.log(`   ✅ تم سحب ${teams.rows.length} فريق`);

    // 4. Projects
    console.log('4️⃣ جاري سحب المشاريع...');
    const projects = await pool.query('SELECT * FROM projects ORDER BY id');
    if (projects.rows.length > 0) {
      sqlContent += '\n-- Projects\n';
      for (const project of projects.rows) {
        const url = project.github_repo_url.replace(/'/g, "''");
        const score = project.clean_code_score || 'NULL';
        const report = project.clean_code_report ? `'${JSON.stringify(project.clean_code_report).replace(/'/g, "''")}'` : 'NULL';
        const timestamp = project.submitted_at ? `'${project.submitted_at.toISOString()}'` : 'CURRENT_TIMESTAMP';
        sqlContent += `INSERT INTO projects (id, team_id, github_repo_url, clean_code_score, clean_code_report, submitted_at) VALUES (${project.id}, ${project.team_id}, '${url}', ${score}, ${report}, ${timestamp});\n`;
      }
    }
    console.log(`   ✅ تم سحب ${projects.rows.length} مشروع`);

    // 5. Evaluations
    console.log('5️⃣ جاري سحب التقييمات...');
    const evaluations = await pool.query('SELECT * FROM evaluations ORDER BY id');
    if (evaluations.rows.length > 0) {
      sqlContent += '\n-- Evaluations\n';
      for (const evaluation of evaluations.rows) {
        sqlContent += `INSERT INTO evaluations (id, judge_id, team_id) VALUES (${evaluation.id}, ${evaluation.judge_id}, ${evaluation.team_id});\n`;
      }
    }
    console.log(`   ✅ تم سحب ${evaluations.rows.length} تقييم`);

    // 6. Evaluation Scores
    console.log('6️⃣ جاري سحب النقاط...');
    const scores = await pool.query('SELECT * FROM evaluation_scores ORDER BY id');
    if (scores.rows.length > 0) {
      sqlContent += '\n-- Evaluation Scores\n';
      for (const score of scores.rows) {
        sqlContent += `INSERT INTO evaluation_scores (id, evaluation_id, criterion_key, score) VALUES (${score.id}, ${score.evaluation_id}, '${score.criterion_key}', ${score.score});\n`;
      }
    }
    console.log(`   ✅ تم سحب ${scores.rows.length} نقطة`);

    // Update sequences
    sqlContent += '\n-- Update Sequences\n';
    sqlContent += `SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));\n`;
    sqlContent += `SELECT setval('judges_id_seq', (SELECT MAX(id) FROM judges));\n`;
    sqlContent += `SELECT setval('teams_id_seq', (SELECT MAX(id) FROM teams));\n`;
    if (projects.rows.length > 0) {
      sqlContent += `SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));\n`;
    }
    if (evaluations.rows.length > 0) {
      sqlContent += `SELECT setval('evaluations_id_seq', (SELECT MAX(id) FROM evaluations));\n`;
    }
    if (scores.rows.length > 0) {
      sqlContent += `SELECT setval('evaluation_scores_id_seq', (SELECT MAX(id) FROM evaluation_scores));\n`;
    }

    // Save to file
    const filename = `backup_render_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.sql`;
    fs.writeFileSync(filename, sqlContent);

    console.log(`\n✅ تم حفظ النسخة الاحتياطية في: ${filename} 🎉\n`);
    
    console.log('📊 ملخص البيانات المحفوظة:');
    console.log(`   - المستخدمين: ${users.rows.length}`);
    console.log(`   - الحكام: ${judges.rows.length}`);
    console.log(`   - الفرق: ${teams.rows.length}`);
    console.log(`   - المشاريع: ${projects.rows.length}`);
    console.log(`   - التقييمات: ${evaluations.rows.length}`);
    console.log(`   - النقاط: ${scores.rows.length}\n`);

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

createBackup();
