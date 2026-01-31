const { pool } = require('./db.js');

async function migrate() {
  try {
    console.log('Starting migration...');
    
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='evaluation_scores' AND column_name='admin_note'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Column admin_note already exists');
    } else {
      await pool.query(`ALTER TABLE evaluation_scores ADD COLUMN admin_note TEXT DEFAULT NULL`);
      console.log('✓ Added admin_note column');
    }
    
    // Create index
    try {
      await pool.query(`CREATE INDEX idx_evaluation_scores_admin_modified ON evaluation_scores(admin_note)`);
      console.log('✓ Created index');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✓ Index already exists');
      } else {
        throw err;
      }
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
