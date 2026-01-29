const { pool } = require('./db');
require('dotenv').config();

async function checkCounts() {
    try {
        const hallStats = await pool.query(`
      SELECT
        hall,
        COUNT(DISTINCT t.id) as teams_count
      FROM teams t
      GROUP BY hall
      ORDER BY hall
    `);
        console.log('Hall Stats:', hallStats.rows);

        const teams = await pool.query(`
      SELECT t.id, u.name, u.email, t.hall, u.team_number
      FROM teams t
      JOIN users u ON t.user_id = u.id
      WHERE t.hall = 'A'
      ORDER BY t.id
    `);
        console.log('Teams in Hall A:', teams.rows.length);
        teams.rows.forEach(team => {
            console.log(`ID: ${team.id}, Name: ${team.name}, Email: ${team.email}, Team Num: ${team.team_number}`);
        });

        await pool.end();
    } catch (error) {
        console.error(error);
    }
}

checkCounts();
