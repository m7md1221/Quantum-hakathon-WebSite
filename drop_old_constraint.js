const { pool } = require('./db');

async function fixDuplicateConstraint() {
    try {
        console.log('Dropping the old score constraint (<= 10)...');

        // Explicitly drop by name which we just confirmed
        await pool.query('ALTER TABLE evaluation_scores DROP CONSTRAINT IF EXISTS "evaluation_scores_score_check"');

        console.log('✅ Old constraint dropped successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error dropping constraint:', error.message);
        process.exit(1);
    }
}

fixDuplicateConstraint();
