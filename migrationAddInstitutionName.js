const { pool } = require('./db.js');

async function migrate() {
  try {
    console.log('Starting migration - Adding institution_name column...');
    
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='users' AND column_name='institution_name'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Column institution_name already exists');
    } else {
      await pool.query(`ALTER TABLE users ADD COLUMN institution_name VARCHAR(255) DEFAULT NULL`);
      console.log('✓ Added institution_name column');
    }
    
    console.log('Migration completed successfully');
    await pool.end();
  } catch (error) {
    console.error('Migration error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

migrate();
