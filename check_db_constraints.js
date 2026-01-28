const { pool } = require('./db');

async function checkConstraints() {
    try {
        const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'evaluation_scores'::regclass 
      AND contype = 'c'
    `);

        console.log('--- Constraints on evaluation_scores ---');
        result.rows.forEach(row => {
            console.log(`Name: ${row.conname}`);
            console.log(`Def:  ${row.def}`);
            console.log('---');
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkConstraints();
