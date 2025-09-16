const { Pool } = require('pg');

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_123456789@ep-rough-sunset-a5h8k8k8.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkRequest682() {
  try {
    console.log('=== ПРОВЕРКА ЗАПРОСА 682 ===');
    
    // Получаем все ответы для запроса 682
    const responsesQuery = `
      SELECT 
        id, 
        supplier_email, 
        subject, 
        processing_status, 
        is_analyzed,
        attachments
      FROM supplier_responses 
      WHERE request_id = 682 AND user_id = 3
      ORDER BY response_date DESC
    `;
    
    const responses = await pool.query(responsesQuery);
    console.log('Найдено ответов:', responses.rows.length);
    
    for (const response of responses.rows) {
      console.log('\n--- Ответ ID:', response.id, '---');
      console.log('Email:', response.supplier_email);
      console.log('Subject:', response.subject);
      console.log('Processing Status:', response.processing_status);
      console.log('Is Analyzed:', response.is_analyzed);
      
      // Проверяем attachments
      if (response.attachments && Array.isArray(response.attachments)) {
        console.log('Attachments count:', response.attachments.length);
        
        for (const attachment of response.attachments) {
          console.log('  - File:', attachment.filename);
          console.log('    Type:', attachment.contentType);
          console.log('    Size:', attachment.size, 'bytes');
          console.log('    Has extracted text:', !!attachment.extractedText);
          console.log('    Text length:', attachment.extractedText ? attachment.extractedText.length : 0);
          if (attachment.extractedText) {
            console.log('    Text preview:', attachment.extractedText.substring(0, 100) + '...');
          }
          console.log('    Processing status:', attachment.processingStatus);
        }
      } else {
        console.log('No attachments or attachments is not an array');
      }
    }
    
    // Проверяем извлеченные параметры
    console.log('\n=== ИЗВЛЕЧЕННЫЕ ПАРАМЕТРЫ ===');
    const paramsQuery = `
      SELECT 
        response_id,
        parameters,
        created_at
      FROM extracted_parameters 
      WHERE response_id IN (SELECT id FROM supplier_responses WHERE request_id = 682 AND user_id = 3)
      ORDER BY created_at DESC
    `;
    
    const params = await pool.query(paramsQuery);
    console.log('Найдено записей параметров:', params.rows.length);
    
    for (const param of params.rows) {
      console.log('\n--- Параметры для ответа ID:', param.response_id, '---');
      console.log('Created at:', param.created_at);
      if (param.parameters) {
        const paramObj = typeof param.parameters === 'string' ? JSON.parse(param.parameters) : param.parameters;
        console.log('Parameters:', Object.keys(paramObj).length, 'items');
        for (const [key, value] of Object.entries(paramObj)) {
          console.log(`  ${key}: ${value}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await pool.end();
  }
}

checkRequest682();
