
/**
 * Migration script to add vectorization columns to semantic_blocks table
 */

const { Pool } = require('pg');
require('dotenv').config();

async function migrateSemanticBlocks() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Adding vectorization columns to semantic_blocks table...');
    
    // Add new columns
    await pool.query(`
      ALTER TABLE semantic_blocks 
      ADD COLUMN IF NOT EXISTS search_vector TEXT,
      ADD COLUMN IF NOT EXISTS optimized_requirements JSONB;
    `);
    
    console.log('✓ Successfully added vectorization columns');
    
    // Create index for better search performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_semantic_blocks_search_vector 
      ON semantic_blocks USING gin(to_tsvector('russian', search_vector));
    `);
    
    console.log('✓ Created search index for vectorized data');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateSemanticBlocks()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateSemanticBlocks };
