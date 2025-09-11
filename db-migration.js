import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addMissingColumns() {
  const client = await pool.connect();
  try {
    console.log('Starting database migration to add missing user_id columns...');
    
    // Begin a transaction
    await client.query('BEGIN');
    
    // Check if user_id column exists in request_suppliers table
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'request_suppliers' AND column_name = 'user_id'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('Adding user_id column to request_suppliers table...');
      
      // Add user_id column to request_suppliers table
      await client.query(`
        ALTER TABLE request_suppliers 
        ADD COLUMN user_id INTEGER REFERENCES users(id)
      `);
      
      // Update user_id values based on the associated search_request's user_id
      await client.query(`
        UPDATE request_suppliers rs
        SET user_id = sr.user_id
        FROM search_requests sr
        WHERE rs.request_id = sr.id
      `);
      
      console.log('Successfully added and populated user_id column in request_suppliers table');
    } else {
      console.log('user_id column already exists in request_suppliers table');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Database migration completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration as an immediately-invoked async function
(async () => {
  try {
    await addMissingColumns();
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();