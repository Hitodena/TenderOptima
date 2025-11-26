import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addTechnicalAnalysisColumns() {
  const client = await pool.connect();
  try {
    console.log('Starting database migration to add analysis_request_id and project_id columns...');
    
    // Begin a transaction
    await client.query('BEGIN');
    
    // Check if analysis_request_id column exists
    const checkAnalysisRequestId = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'technical_analysis_requests' AND column_name = 'analysis_request_id'
    `);
    
    if (checkAnalysisRequestId.rows.length === 0) {
      console.log('Adding analysis_request_id column to technical_analysis_requests table...');
      await client.query(`
        ALTER TABLE technical_analysis_requests
        ADD COLUMN analysis_request_id INTEGER
      `);
      console.log('✓ Added analysis_request_id column');
    } else {
      console.log('analysis_request_id column already exists');
    }
    
    // Check if project_id column exists
    const checkProjectId = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'technical_analysis_requests' AND column_name = 'project_id'
    `);
    
    if (checkProjectId.rows.length === 0) {
      console.log('Adding project_id column to technical_analysis_requests table...');
      await client.query(`
        ALTER TABLE technical_analysis_requests
        ADD COLUMN project_id INTEGER
      `);
      console.log('✓ Added project_id column');
    } else {
      console.log('project_id column already exists');
    }
    
    // Add foreign key constraint for analysis_request_id
    const checkFk1 = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'technical_analysis_requests' 
      AND constraint_name = 'technical_analysis_requests_analysis_request_id_fkey'
    `);
    
    if (checkFk1.rows.length === 0) {
      console.log('Adding foreign key constraint for analysis_request_id...');
      await client.query(`
        ALTER TABLE technical_analysis_requests
        ADD CONSTRAINT technical_analysis_requests_analysis_request_id_fkey
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE SET NULL
      `);
      console.log('✓ Added foreign key constraint for analysis_request_id');
    } else {
      console.log('Foreign key constraint for analysis_request_id already exists');
    }
    
    // Add foreign key constraint for project_id
    const checkFk2 = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'technical_analysis_requests' 
      AND constraint_name = 'technical_analysis_requests_project_id_fkey'
    `);
    
    if (checkFk2.rows.length === 0) {
      console.log('Adding foreign key constraint for project_id...');
      await client.query(`
        ALTER TABLE technical_analysis_requests
        ADD CONSTRAINT technical_analysis_requests_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES analysis_projects(id) ON DELETE SET NULL
      `);
      console.log('✓ Added foreign key constraint for project_id');
    } else {
      console.log('Foreign key constraint for project_id already exists');
    }
    
    // Add indexes
    const checkIdx1 = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'technical_analysis_requests' 
      AND indexname = 'idx_technical_analysis_requests_analysis_request_id'
    `);
    
    if (checkIdx1.rows.length === 0) {
      console.log('Creating index for analysis_request_id...');
      await client.query(`
        CREATE INDEX idx_technical_analysis_requests_analysis_request_id 
        ON technical_analysis_requests(analysis_request_id)
      `);
      console.log('✓ Created index for analysis_request_id');
    } else {
      console.log('Index for analysis_request_id already exists');
    }
    
    const checkIdx2 = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'technical_analysis_requests' 
      AND indexname = 'idx_technical_analysis_requests_project_id'
    `);
    
    if (checkIdx2.rows.length === 0) {
      console.log('Creating index for project_id...');
      await client.query(`
        CREATE INDEX idx_technical_analysis_requests_project_id 
        ON technical_analysis_requests(project_id)
      `);
      console.log('✓ Created index for project_id');
    } else {
      console.log('Index for project_id already exists');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('✓ Database migration completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during database migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
(async () => {
  try {
    await addTechnicalAnalysisColumns();
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();

