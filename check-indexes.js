const { Pool } = require('pg');
require('dotenv').config({ path: './env.dev' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkIndexes() {
  const client = await pool.connect();
  try {
    console.log('🔍 Проверяем индексы для supplier_responses...');
    
    const result = await client.query(`
      SELECT 
        indexname, 
        indexdef 
      FROM pg_indexes 
      WHERE tablename = 'supplier_responses' 
      ORDER BY indexname;
    `);
    
    console.log('📋 Найденные индексы:');
    result.rows.forEach(row => {
      console.log(`  - ${row.indexname}: ${row.indexdef}`);
    });
    
    // Проверяем план выполнения запроса
    console.log('\n🔍 План выполнения запроса:');
    const explainResult = await client.query(`
      EXPLAIN (ANALYZE, BUFFERS) 
      SELECT * FROM supplier_responses 
      WHERE request_id = 682 AND user_id = 3 
      ORDER BY response_date DESC;
    `);
    
    explainResult.rows.forEach(row => {
      console.log(row['QUERY PLAN']);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkIndexes();
