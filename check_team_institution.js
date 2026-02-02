const { pool } = require('./db');

(async () => {
  try {
    const teamId = process.argv[2] ? parseInt(process.argv[2], 10) : 66;
    const result = await pool.query(
      'SELECT t.id as team_id, u.id as user_id, u.name, u.team_number, u.team_institution FROM teams t JOIN users u ON t.user_id = u.id WHERE t.id = $1',
      [teamId]
    );
    console.log(result.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
})();
