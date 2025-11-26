import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateExistingRecords() {
  const client = await pool.connect();
  try {
    console.log('Checking for technical_analysis_requests without analysis_request_id...');
    
    // Находим записи без analysis_request_id
    const recordsWithoutLink = await client.query(`
      SELECT tar.id, tar.user_id, tar.created_at
      FROM technical_analysis_requests tar
      WHERE tar.analysis_request_id IS NULL
      ORDER BY tar.created_at DESC
    `);
    
    console.log(`Found ${recordsWithoutLink.rows.length} records without analysis_request_id`);
    
    if (recordsWithoutLink.rows.length === 0) {
      console.log('✓ All records are properly linked');
      return;
    }
    
    // Пытаемся найти связь по user_id и дате создания
    for (const record of recordsWithoutLink.rows) {
      const possibleLinks = await client.query(`
        SELECT ar.id, ar.created_at
        FROM analysis_requests ar
        WHERE ar.user_id = $1 
          AND ar.type = 'technical_analysis'
          AND ABS(EXTRACT(EPOCH FROM (ar.created_at - $2::timestamp))) < 3600
        ORDER BY ABS(EXTRACT(EPOCH FROM (ar.created_at - $2::timestamp)))
        LIMIT 1
      `, [record.user_id, record.created_at]);
      
      if (possibleLinks.rows.length > 0) {
        const analysisRequestId = possibleLinks.rows[0].id;
        console.log(`Linking technical_analysis_request ${record.id} to analysis_request ${analysisRequestId}`);
        
        await client.query(`
          UPDATE technical_analysis_requests
          SET analysis_request_id = $1
          WHERE id = $2
        `, [analysisRequestId, record.id]);
      } else {
        console.log(`⚠ Could not find link for technical_analysis_request ${record.id}`);
      }
    }
    
    console.log('✓ Update completed');
    
  } catch (error) {
    console.error('❌ Error updating records:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the update
(async () => {
  try {
    await updateExistingRecords();
    console.log('Update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
})();

