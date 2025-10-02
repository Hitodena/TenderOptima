const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Применяем миграцию для добавления полей статуса обработки...');
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'migrations', 'add-processing-status.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Выполняем миграцию
    await client.query(sql);
    
    console.log('✅ Миграция успешно применена!');
    console.log('📋 Добавлены поля:');
    console.log('   - processing_status (TEXT, DEFAULT "pending")');
    console.log('   - processing_started_at (TIMESTAMP)');
    console.log('   - processing_completed_at (TIMESTAMP)');
    console.log('   - processing_error (TEXT)');
    console.log('   - Индексы для оптимизации');
    
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(console.error);
