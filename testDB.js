const { pool } = require('./db');

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database!');
    client.release();
    pool.end();
  } catch (error) {
    console.error('Connection failed:', error.message);
    pool.end();
  }
}

testConnection();