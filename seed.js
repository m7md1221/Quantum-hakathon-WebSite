const bcrypt = require('bcryptjs');
const { pool } = require('./db');

async function seed() {
  try {
    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Admin
    await pool.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', ['Admin User', 'admin@khakathon.com', hashedPassword, 'admin']);

    // Judges
    const halls = ['A', 'B', 'C', 'D'];
    for (let h = 0; h < halls.length; h++) {
      const hall = halls[h];
      for (let i = 1; i <= 5; i++) {
        await pool.query('INSERT INTO users (name, email, password, role, hall) VALUES ($1, $2, $3, $4, $5)', [`Judge ${hall}${i}`, `judge_${hall.toLowerCase()}${i}@khakathon.com`, hashedPassword, 'judge', hall]);
      }
    }

    // Insert judges
    await pool.query('INSERT INTO judges (user_id, hall) SELECT id, hall FROM users WHERE role = \'judge\'');

    // Teams
    for (let h = 0; h < halls.length; h++) {
      const hall = halls[h];
      for (let i = 1; i <= 20; i++) {
        await pool.query('INSERT INTO users (name, email, password, role, hall) VALUES ($1, $2, $3, $4, $5)', [`Team ${hall}${i}`, `team_${hall.toLowerCase()}${i}@khakathon.com`, hashedPassword, 'team', hall]);
      }
    }

    // Insert teams
    await pool.query('INSERT INTO teams (user_id, hall) SELECT id, hall FROM users WHERE role = \'team\'');

    console.log('Seeding completed');
  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}

seed();