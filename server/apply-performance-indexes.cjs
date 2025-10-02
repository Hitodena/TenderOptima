const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyIndexes() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Применяем индексы для ускорения запросов...');
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'migrations', 'add-performance-indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Выполняем создание индексов
    await client.query(sql);
    
    console.log('✅ Индексы успешно созданы!');
    console.log('📋 Добавлены индексы для:');
    console.log('   - supplier_responses (request_id, user_id)');
    console.log('   - supplier_responses (user_id, request_id)');
    console.log('   - supplier_responses (response_date)');
    console.log('   - search_requests (user_id, status)');
    console.log('   - request_suppliers (user_id, request_id)');
    console.log('   - И другие оптимизирующие индексы');
    
  } catch (error) {
    console.error('❌ Ошибка при создании индексов:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyIndexes().catch(console.error);
