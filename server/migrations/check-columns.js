import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    console.log('Checking columns in technical_analysis_requests...');
    
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'technical_analysis_requests' 
      AND column_name IN ('analysis_request_id', 'project_id')
      ORDER BY column_name
    `);
    
    console.log('\nFound columns:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length === 0) {
      console.log('\n❌ Columns analysis_request_id and project_id are MISSING!');
      console.log('Need to run migration: node server/migrations/add-technical-analysis-columns.js');
    } else if (result.rows.length === 2) {
      console.log('\n✅ Both columns exist');
    } else {
      console.log('\n⚠️  Only one column exists');
    }
    
    // Check recent records
    const recentRecords = await client.query(`
      SELECT id, analysis_request_id, project_id, created_at
      FROM technical_analysis_requests
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('\nRecent records:');
    console.log(JSON.stringify(recentRecords.rows, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

