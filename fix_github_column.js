/**
 * Fix Database Schema - Add github_url column to projects table
 * This script updates the projects table structure for GitHub URLs
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection - use DATABASE_URL if available, otherwise use individual vars
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

async function fixDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting database schema fix...\n');
    
    // Step 1: Check if github_url column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'github_url'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Column github_url already exists!');
      return;
    }
    
    console.log('❌ Column github_url does not exist. Adding it...\n');
    
    // Step 2: Check if file_path column exists
    const checkFileColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'file_path'
    `);
    
    if (checkFileColumn.rows.length > 0) {
      console.log('📋 Found old file_path column. Dropping table and recreating...\n');
      
      // Drop the old table
      await client.query('DROP TABLE IF EXISTS projects CASCADE');
      console.log('✅ Dropped old projects table');
    }
    
    // Step 3: Create new projects table with github_url
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        github_url VARCHAR(500) NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id)
      )
    `);
    console.log('✅ Created projects table with github_url column');
    
    // Step 4: Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id)
    `);
    console.log('✅ Created index on team_id');
    
    // Step 5: Verify the schema
    const verify = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Projects table structure:');
    console.log('─'.repeat(50));
    verify.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(15)} | ${row.data_type.padEnd(20)} | ${row.is_nullable}`);
    });
    console.log('─'.repeat(50));
    
    console.log('\n✨ Database schema fix completed successfully!');
    console.log('🚀 You can now restart the server with: npm start\n');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error.message);
    console.error('\n💡 Please check:');
    console.error('  1. Database connection details in .env file');
    console.error('  2. PostgreSQL is running');
    console.error('  3. Database exists\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixDatabase();
