const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'quantum_khakathon'
      }
);

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Applying clean code migration...\n');
    
    await client.query('BEGIN');
    
    // Rename github_url to github_repo_url if needed
    const checkOldColumn = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'github_url'
    `);
    
    if (checkOldColumn.rows.length > 0) {
      console.log('Renaming github_url to github_repo_url...');
      await client.query('ALTER TABLE projects RENAME COLUMN github_url TO github_repo_url');
      console.log('✅ Renamed');
    } else {
      console.log('✓ github_repo_url already exists');
    }
    
    // Add clean_code_score
    const checkScore = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'clean_code_score'
    `);
    
    if (checkScore.rows.length === 0) {
      console.log('Adding clean_code_score column...');
      await client.query('ALTER TABLE projects ADD COLUMN clean_code_score INTEGER');
      console.log('✅ Added');
    } else {
      console.log('✓ clean_code_score already exists');
    }
    
    // Add clean_code_report
    const checkReport = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'clean_code_report'
    `);
    
    if (checkReport.rows.length === 0) {
      console.log('Adding clean_code_report column...');
      await client.query('ALTER TABLE projects ADD COLUMN clean_code_report JSON');
      console.log('✅ Added');
    } else {
      console.log('✓ clean_code_report already exists');
    }
    
    // Add eslint_error_count
    const checkErrors = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'eslint_error_count'
    `);
    
    if (checkErrors.rows.length === 0) {
      console.log('Adding eslint_error_count column...');
      await client.query('ALTER TABLE projects ADD COLUMN eslint_error_count INTEGER');
      console.log('✅ Added');
    } else {
      console.log('✓ eslint_error_count already exists');
    }
    
    // Add eslint_warning_count
    const checkWarnings = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'eslint_warning_count'
    `);
    
    if (checkWarnings.rows.length === 0) {
      console.log('Adding eslint_warning_count column...');
      await client.query('ALTER TABLE projects ADD COLUMN eslint_warning_count INTEGER');
      console.log('✅ Added');
    } else {
      console.log('✓ eslint_warning_count already exists');
    }
    
    // Add last_evaluated_at
    const checkEvaluated = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'last_evaluated_at'
    `);
    
    if (checkEvaluated.rows.length === 0) {
      console.log('Adding last_evaluated_at column...');
      await client.query('ALTER TABLE projects ADD COLUMN last_evaluated_at TIMESTAMP');
      console.log('✅ Added');
    } else {
      console.log('✓ last_evaluated_at already exists');
    }
    
    // Add clean_code_status
    const checkStatus = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'clean_code_status'
    `);
    
    if (checkStatus.rows.length === 0) {
      console.log('Adding clean_code_status column...');
      await client.query('ALTER TABLE projects ADD COLUMN clean_code_status VARCHAR(20) DEFAULT \'pending\'');
      console.log('✅ Added');
    } else {
      console.log('✓ clean_code_status already exists');
    }
    
    // Add clean_code_failure_reason
    const checkReason = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'clean_code_failure_reason'
    `);
    
    if (checkReason.rows.length === 0) {
      console.log('Adding clean_code_failure_reason column...');
      await client.query('ALTER TABLE projects ADD COLUMN clean_code_failure_reason TEXT');
      console.log('✅ Added');
    } else {
      console.log('✓ clean_code_failure_reason already exists');
    }
    
    await client.query('COMMIT');
    
    console.log('\n✨ Clean code migration completed successfully!');
    
    // Display schema
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Projects table structure:');
    console.log('──────────────────────────────────────────────────');
    schema.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(30)} | ${col.data_type.padEnd(25)} | ${col.is_nullable}`);
    });
    console.log('──────────────────────────────────────────────────');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
