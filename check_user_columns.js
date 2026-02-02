const { pool } = require('./db');

(async () => {
  try {
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%institution%' ORDER BY column_name"
    );
    console.log(result.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
})();
