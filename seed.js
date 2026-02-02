const bcrypt = require('bcryptjs');
const { pool } = require('./db');

// Generate unique password for each user
function generatePassword(role, hall, index) {
  // Format: Role_Hall_Index (e.g., Admin_Default_1, Judge_A_1, Team_B_5)
  let hallCode = hall || 'Default';
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}_${hallCode}_${index}`;
}

async function seed() {
  try {
    const userPasswords = []; // Store passwords for logging

    // Admin
    const adminPassword = generatePassword('admin', 'admin', 1);
    const adminHashedPassword = await bcrypt.hash(adminPassword, 10);
    await pool.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', 
      ['Admin User', 'admin@khakathon.com', adminHashedPassword, 'admin']);
    userPasswords.push({ email: 'admin@khakathon.com', password: adminPassword });

    // Judges
    const halls = ['A', 'B', 'C', 'D'];
    for (let h = 0; h < halls.length; h++) {
      const hall = halls[h];
      for (let i = 1; i <= 5; i++) {
        const judgePassword = generatePassword('judge', hall, i);
        const judgeHashedPassword = await bcrypt.hash(judgePassword, 10);
        const email = `judge_${hall.toLowerCase()}${i}@khakathon.com`;
        await pool.query('INSERT INTO users (name, email, password, role, hall) VALUES ($1, $2, $3, $4, $5)', 
          [`Judge ${hall}${i}`, email, judgeHashedPassword, 'judge', hall]);
        userPasswords.push({ email, password: judgePassword });
      }
    }

    // Insert judges
    await pool.query('INSERT INTO judges (user_id, hall) SELECT id, hall FROM users WHERE role = \'judge\'');

    // Teams
    for (let h = 0; h < halls.length; h++) {
      const hall = halls[h];
      for (let i = 1; i <= 20; i++) {
        const teamPassword = generatePassword('team', hall, i);
        const teamHashedPassword = await bcrypt.hash(teamPassword, 10);
        const email = `team_${hall.toLowerCase()}${i}@khakathon.com`;
        await pool.query('INSERT INTO users (name, email, password, role, hall) VALUES ($1, $2, $3, $4, $5)', 
          [`Team ${hall}${i}`, email, teamHashedPassword, 'team', hall]);
        userPasswords.push({ email, password: teamPassword });
      }
    }

    // Insert teams
    await pool.query('INSERT INTO teams (user_id, hall) SELECT id, hall FROM users WHERE role = \'team\'');

    // Log all passwords to console
    console.log('\n✅ Seeding completed successfully!\n');
    console.log('📋 All User Credentials:');
    console.log('=' .repeat(60));
    userPasswords.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}, Password: ${user.password}`);
    });
    console.log('=' .repeat(60) + '\n');

  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}

seed();