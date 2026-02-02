const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Render database connection
const renderPool = new Pool({
  connectionString: 'postgresql://database_quntam_hakhathon_user:sB6lGb9ahfGrGDU9ePz2BsT9j22mfW6Q@dpg-d5r8qnffte5s73c5t4ug-a.oregon-postgres.render.com:5432/database_quntam_hakhathon?sslmode=require'
});

// Local database connection
const localPool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/quantum_khakathon'
});

async function copyData() {
  try {
    console.log('📥 جاري نسخ البيانات من Render...\n');

    // 1. Fetch all users from Render
    console.log('1️⃣ جاري نسخ المستخدمين...');
    const users = await renderPool.query('SELECT * FROM users ORDER BY id');
    console.log(`   ✅ تم جلب ${users.rows.length} مستخدم`);

    // 2. Fetch all judges
    console.log('2️⃣ جاري نسخ الحكام...');
    const judges = await renderPool.query('SELECT * FROM judges ORDER BY id');
    console.log(`   ✅ تم جلب ${judges.rows.length} حكم`);

    // 3. Fetch all teams
    console.log('3️⃣ جاري نسخ الفرق...');
    const teams = await renderPool.query('SELECT * FROM teams ORDER BY id');
    console.log(`   ✅ تم جلب ${teams.rows.length} فريق`);

    // 4. Fetch all projects
    console.log('4️⃣ جاري نسخ المشاريع...');
    const projects = await renderPool.query('SELECT * FROM projects ORDER BY id');
    console.log(`   ✅ تم جلب ${projects.rows.length} مشروع`);

    // 5. Fetch all evaluations
    console.log('5️⃣ جاري نسخ التقييمات...');
    const evaluations = await renderPool.query('SELECT * FROM evaluations ORDER BY id');
    console.log(`   ✅ تم جلب ${evaluations.rows.length} تقييم`);

    // 6. Fetch all evaluation scores
    console.log('6️⃣ جاري نسخ النقاط...');
    const scores = await renderPool.query('SELECT * FROM evaluation_scores ORDER BY id');
    console.log(`   ✅ تم جلب ${scores.rows.length} نقطة`);

    console.log('\n📤 جاري إدخال البيانات إلى قاعدة البيانات المحلية...\n');

    // Insert users
    console.log('1️⃣ إدخال المستخدمين...');
    for (const user of users.rows) {
      await localPool.query(
        'INSERT INTO users (id, name, email, password, role, hall) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO UPDATE SET name = $2, password = $4, role = $5, hall = $6',
        [user.id, user.name, user.email, user.password, user.role, user.hall]
      );
    }
    console.log(`   ✅ تم إدخال ${users.rows.length} مستخدم`);

    // Insert judges
    console.log('2️⃣ إدخال الحكام...');
    for (const judge of judges.rows) {
      await localPool.query(
        'INSERT INTO judges (id, user_id, hall) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [judge.id, judge.user_id, judge.hall]
      );
    }
    console.log(`   ✅ تم إدخال ${judges.rows.length} حكم`);

    // Insert teams
    console.log('3️⃣ إدخال الفرق...');
    for (const team of teams.rows) {
      await localPool.query(
        'INSERT INTO teams (id, user_id, hall) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [team.id, team.user_id, team.hall]
      );
    }
    console.log(`   ✅ تم إدخال ${teams.rows.length} فريق`);

    // Insert projects
    if (projects.rows.length > 0) {
      console.log('4️⃣ إدخال المشاريع...');
      for (const project of projects.rows) {
        await localPool.query(
          'INSERT INTO projects (id, team_id, github_repo_url, clean_code_score, clean_code_report, submitted_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (team_id) DO UPDATE SET github_repo_url = $3, clean_code_score = $4, clean_code_report = $5',
          [project.id, project.team_id, project.github_repo_url, project.clean_code_score, project.clean_code_report, project.submitted_at]
        );
      }
      console.log(`   ✅ تم إدخال ${projects.rows.length} مشروع`);
    }

    // Insert evaluations
    if (evaluations.rows.length > 0) {
      console.log('5️⃣ إدخال التقييمات...');
      for (const evaluation of evaluations.rows) {
        await localPool.query(
          'INSERT INTO evaluations (id, judge_id, team_id) VALUES ($1, $2, $3) ON CONFLICT (judge_id, team_id) DO NOTHING',
          [evaluation.id, evaluation.judge_id, evaluation.team_id]
        );
      }
      console.log(`   ✅ تم إدخال ${evaluations.rows.length} تقييم`);
    }

    // Insert evaluation scores
    if (scores.rows.length > 0) {
      console.log('6️⃣ إدخال النقاط...');
      for (const score of scores.rows) {
        await localPool.query(
          'INSERT INTO evaluation_scores (id, evaluation_id, criterion_key, score) VALUES ($1, $2, $3, $4) ON CONFLICT (evaluation_id, criterion_key) DO UPDATE SET score = $4',
          [score.id, score.evaluation_id, score.criterion_key, score.score]
        );
      }
      console.log(`   ✅ تم إدخال ${scores.rows.length} نقطة`);
    }

    // Update sequences
    console.log('\n7️⃣ تحديث sequences...');
    await localPool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    await localPool.query(`SELECT setval('judges_id_seq', (SELECT MAX(id) FROM judges))`);
    await localPool.query(`SELECT setval('teams_id_seq', (SELECT MAX(id) FROM teams))`);
    if (projects.rows.length > 0) {
      await localPool.query(`SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects))`);
    }
    if (evaluations.rows.length > 0) {
      await localPool.query(`SELECT setval('evaluations_id_seq', (SELECT MAX(id) FROM evaluations))`);
    }
    if (scores.rows.length > 0) {
      await localPool.query(`SELECT setval('evaluation_scores_id_seq', (SELECT MAX(id) FROM evaluation_scores))`);
    }
    console.log('   ✅ تم تحديث جميع الـ sequences');

    console.log('\n✅ تم نسخ جميع البيانات بنجاح! 🎉\n');

    // Summary
    console.log('📊 ملخص البيانات المنسوخة:');
    console.log(`   - المستخدمين: ${users.rows.length}`);
    console.log(`   - الحكام: ${judges.rows.length}`);
    console.log(`   - الفرق: ${teams.rows.length}`);
    console.log(`   - المشاريع: ${projects.rows.length}`);
    console.log(`   - التقييمات: ${evaluations.rows.length}`);
    console.log(`   - النقاط: ${scores.rows.length}`);

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    console.error(error);
  } finally {
    await renderPool.end();
    await localPool.end();
  }
}

copyData();
