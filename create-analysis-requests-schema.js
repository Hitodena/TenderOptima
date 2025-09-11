import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createAnalysisRequestsSchema() {
  try {
    console.log('Creating analysis requests schema...');
    
    // Create analysis_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_requests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type VARCHAR(50) NOT NULL CHECK (type IN ('technical_analysis', 'parameter_analysis')),
          status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create analysis_request_parameters table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_request_parameters (
          id SERIAL PRIMARY KEY,
          request_id INTEGER NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
          parameter_name VARCHAR(255) NOT NULL,
          parameter_value TEXT,
          confidence DECIMAL(3,2) DEFAULT 1.0,
          is_approved BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create analysis_request_suppliers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_request_suppliers (
          id SERIAL PRIMARY KEY,
          request_id INTEGER NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
          supplier_name VARCHAR(255) NOT NULL,
          supplier_email VARCHAR(255),
          status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'analyzed')),
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create analysis_request_files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_request_files (
          id SERIAL PRIMARY KEY,
          request_id INTEGER NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
          supplier_id INTEGER REFERENCES analysis_request_suppliers(id) ON DELETE CASCADE,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_path TEXT,
          file_size INTEGER,
          mime_type VARCHAR(100),
          file_data BYTEA,
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_analysis_requests_user_id ON analysis_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_analysis_requests_type ON analysis_requests(type);
      CREATE INDEX IF NOT EXISTS idx_analysis_requests_status ON analysis_requests(status);
      CREATE INDEX IF NOT EXISTS idx_analysis_request_parameters_request_id ON analysis_request_parameters(request_id);
      CREATE INDEX IF NOT EXISTS idx_analysis_request_suppliers_request_id ON analysis_request_suppliers(request_id);
      CREATE INDEX IF NOT EXISTS idx_analysis_request_files_request_id ON analysis_request_files(request_id);
    `);

    // Create or replace the updated_at trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger for analysis_requests
    await pool.query(`
      DROP TRIGGER IF EXISTS update_analysis_requests_updated_at ON analysis_requests;
      CREATE TRIGGER update_analysis_requests_updated_at 
          BEFORE UPDATE ON analysis_requests 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✓ Analysis requests schema created successfully');
    
  } catch (error) {
    console.error('Error creating analysis requests schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the schema creation
createAnalysisRequestsSchema()
  .then(() => {
    console.log('Schema creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Schema creation failed:', error);
    process.exit(1);
  });

export { createAnalysisRequestsSchema };