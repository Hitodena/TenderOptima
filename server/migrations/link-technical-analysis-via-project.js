import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function linkViaProject() {
  const client = await pool.connect();
  try {
    console.log('Linking technical_analysis_requests via project_id...');
    
    // Находим записи без analysis_request_id, но с project_id
    const recordsWithoutLink = await client.query(`
      SELECT tar.id, tar.project_id, tar.created_at
      FROM technical_analysis_requests tar
      WHERE tar.analysis_request_id IS NULL 
        AND tar.project_id IS NOT NULL
      ORDER BY tar.created_at DESC
    `);
    
    console.log(`Found ${recordsWithoutLink.rows.length} records without analysis_request_id but with project_id`);
    
    if (recordsWithoutLink.rows.length === 0) {
      console.log('✓ All records are properly linked');
      return;
    }
    
    // Пытаемся найти связь через project_id -> analysis_projects -> analysis_request_id
    for (const record of recordsWithoutLink.rows) {
      const projectLink = await client.query(`
        SELECT analysis_request_id
        FROM analysis_projects
        WHERE id = $1
      `, [record.project_id]);
      
      if (projectLink.rows.length > 0 && projectLink.rows[0].analysis_request_id) {
        const analysisRequestId = projectLink.rows[0].analysis_request_id;
        console.log(`Linking technical_analysis_request ${record.id} (project_id=${record.project_id}) to analysis_request ${analysisRequestId}`);
        
        await client.query(`
          UPDATE technical_analysis_requests
          SET analysis_request_id = $1
          WHERE id = $2
        `, [analysisRequestId, record.id]);
      } else {
        console.log(`⚠ Could not find analysis_request_id for project ${record.project_id} (technical_analysis_request ${record.id})`);
      }
    }
    
    console.log('✓ Update completed');
    
  } catch (error) {
    console.error('❌ Error updating records:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

linkViaProject().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

