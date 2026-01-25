const { pool } = require('./db');
const fs = require('fs');

async function runSchema() {
  try {
    const schemaSQL = fs.readFileSync('./schema.sql', 'utf8');
    await pool.query(schemaSQL);
    console.log('Schema created successfully!');
    pool.end();
  } catch (error) {
    console.error('Error running schema:', error.message);
    pool.end();
  }
}

runSchema();