const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  try {
    console.log('Applying migration: Add UNIQUE constraint to evaluation_scores...');
    
    // Check if constraint already exists
    const checkResult = await pool.query(`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'evaluation_scores_evaluation_id_criterion_key_key'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Constraint already exists. Migration not needed.');
      process.exit(0);
    }

    // Add UNIQUE constraint
    await pool.query(`
      ALTER TABLE evaluation_scores 
      ADD CONSTRAINT evaluation_scores_evaluation_id_criterion_key_key 
      UNIQUE (evaluation_id, criterion_key)
    `);

    console.log('✅ Migration applied successfully!');
    console.log('The UNIQUE constraint has been added to evaluation_scores table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();
