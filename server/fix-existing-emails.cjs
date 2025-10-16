const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixExistingEmails() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Исправляем статусы существующих email...');
    
    // Находим все email с вложениями, которые имеют processingStatus = 'pending'
    const result = await client.query(`
      SELECT id, attachments, processing_status, is_analyzed 
      FROM supplier_responses 
      WHERE processing_status = 'pending' 
      AND attachments IS NOT NULL 
      AND jsonb_array_length(attachments) > 0
    `);
    
    console.log(`📧 Найдено ${result.rows.length} email с вложениями и статусом 'pending'`);
    
    for (const row of result.rows) {
      const responseId = row.id;
      const attachments = row.attachments;
      const attachmentCount = Array.isArray(attachments) ? attachments.length : 0;
      
      console.log(`📧 Email ID ${responseId}: ${attachmentCount} вложений`);
      
      // Обновляем статус на 'processing' для email с вложениями
      await client.query(`
        UPDATE supplier_responses 
        SET processing_status = 'processing', 
            processing_started_at = NOW()
        WHERE id = $1
      `, [responseId]);
      
      console.log(`✅ Обновлен статус email ID ${responseId} на 'processing'`);
    }
    
    console.log('✅ Все существующие email исправлены!');
    console.log('📋 Теперь email с вложениями будут скрыты до завершения обработки');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении email:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixExistingEmails().catch(console.error);
