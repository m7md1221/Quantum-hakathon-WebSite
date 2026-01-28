const { pool } = require('./db');

async function fixConstraint() {
    try {
        console.log('Updating evaluation_scores check constraint to allow scores up to 15...');

        // Find the constraint name that contains 'score <= 10'
        const findConstraint = await pool.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'evaluation_scores'::regclass 
      AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%score <= 10%'
    `);

        if (findConstraint.rows.length > 0) {
            const constraintName = findConstraint.rows[0].conname;
            console.log(`Found constraint: ${constraintName}. Dropping it...`);
            await pool.query(`ALTER TABLE evaluation_scores DROP CONSTRAINT "${constraintName}"`);
        } else {
            console.log('Old score <= 10 constraint not found. It might have been already removed or named differently.');
        }

        // Check if the new constraint already exists to avoid duplicate errors
        const checkNew = await pool.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'evaluation_scores'::regclass 
      AND conname = 'evaluation_scores_score_check_v2'
    `);

        if (checkNew.rows.length === 0) {
            console.log('Adding new constraint (score <= 15)...');
            await pool.query(`
        ALTER TABLE evaluation_scores 
        ADD CONSTRAINT evaluation_scores_score_check_v2 
        CHECK (score >= 0 AND score <= 15)
      `);
            console.log('✅ New constraint added successfully!');
        } else {
            console.log('✅ New constraint already exists.');
        }

        console.log('✅ Migration completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error applying migration:', error.message);
        console.error(error);
        process.exit(1);
    }
}

fixConstraint();
