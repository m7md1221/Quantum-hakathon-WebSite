const { pool } = require('./db');

async function fixScoreConstraint() {
  console.log('Starting score constraint fix...');
  
  try {
    // Drop the old constraint
    console.log('Dropping old constraint...');
    await pool.query(`
      ALTER TABLE evaluation_scores DROP CONSTRAINT IF EXISTS evaluation_scores_score_check;
    `);
    console.log('✅ Old constraint dropped');

    // Add new constraint that allows scores up to 15
    console.log('Adding new constraint (0-15)...');
    await pool.query(`
      ALTER TABLE evaluation_scores ADD CONSTRAINT evaluation_scores_score_check CHECK (score >= 0 AND score <= 15);
    `);
    console.log('✅ New constraint added');

    // Verify the change
    const result = await pool.query(`
      SELECT 
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'evaluation_scores'::regclass
        AND conname = 'evaluation_scores_score_check';
    `);

    console.log('\n📋 Constraint verification:');
    console.log(result.rows);
    
    console.log('\n✅ Score constraint fixed successfully!');
    console.log('Scores can now be from 0 to 15');
    
  } catch (error) {
    console.error('❌ Error fixing score constraint:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixScoreConstraint();
