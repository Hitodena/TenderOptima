/**
 * Тест обработки вложений для диагностики проблемы
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5001/api';

async function testAttachmentProcessing() {
  console.log('🔍 Тестирование обработки вложений...\n');
  
  try {
    // Получаем список ответов с вложениями
    console.log('📧 Получение ответов с вложениями...');
    const responsesResponse = await fetch(`${API_BASE}/supplier-responses?limit=10`);
    
    if (!responsesResponse.ok) {
      console.log('❌ Не удалось получить список ответов:', responsesResponse.status);
      return;
    }
    
    const responses = await responsesResponse.json();
    
    if (!responses || responses.length === 0) {
      console.log('❌ Нет ответов поставщиков для тестирования');
      return;
    }
    
    // Ищем ответы с вложениями
    const responsesWithAttachments = responses.filter(response => 
      response.attachments && response.attachments.length > 0
    );
    
    if (responsesWithAttachments.length === 0) {
      console.log('❌ Нет ответов с вложениями для тестирования');
      return;
    }
    
    console.log(`✅ Найдено ${responsesWithAttachments.length} ответов с вложениями\n`);
    
    // Тестируем первый ответ с вложениями
    const testResponse = responsesWithAttachments[0];
    console.log(`📋 Тестирование ответа ID: ${testResponse.id}`);
    console.log(`   Поставщик: ${testResponse.supplierEmail}`);
    console.log(`   Тема: ${testResponse.subject}`);
    console.log(`   Вложений: ${testResponse.attachments.length}`);
    
    // Показываем информацию о вложениях
    testResponse.attachments.forEach((attachment, index) => {
      console.log(`   Вложение ${index + 1}:`);
      console.log(`     - Файл: ${attachment.filename}`);
      console.log(`     - Размер: ${attachment.size} байт`);
      console.log(`     - Тип: ${attachment.contentType}`);
      console.log(`     - Извлеченный текст: ${attachment.extractedText ? 'Да' : 'Нет'}`);
      if (attachment.extractedText) {
        console.log(`     - Длина текста: ${attachment.extractedText.length} символов`);
        console.log(`     - Превью: ${attachment.extractedText.substring(0, 100)}...`);
      }
    });
    
    console.log('\n🔄 Тестирование принудительной обработки вложений...');
    
    // Тестируем принудительную обработку вложений
    try {
      const processResponse = await fetch(`${API_BASE}/supplier-responses/${testResponse.id}/analyze-attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      
      if (processResponse.ok) {
        const processResult = await processResponse.json();
        console.log('✅ Обработка вложений успешна');
        console.log('Результат:', JSON.stringify(processResult, null, 2));
        
        // Проверяем, извлекся ли текст
        if (processResult.processed_attachments) {
          processResult.processed_attachments.forEach((attachment, index) => {
            console.log(`\nОбработанное вложение ${index + 1}:`);
            console.log(`  - Файл: ${attachment.filename}`);
            console.log(`  - Извлеченный текст: ${attachment.extracted_text ? 'Да' : 'Нет'}`);
            if (attachment.extracted_text) {
              console.log(`  - Длина: ${attachment.extracted_text.length} символов`);
              console.log(`  - Превью: ${attachment.extracted_text.substring(0, 200)}...`);
            }
          });
        }
      } else {
        console.log('❌ Ошибка обработки вложений:', processResponse.status);
        const errorText = await processResponse.text();
        console.log('Ошибка:', errorText);
      }
    } catch (error) {
      console.log('❌ Ошибка при запросе обработки вложений:', error.message);
    }
    
    console.log('\n🔍 Проверка извлеченных параметров...');
    
    // Проверяем извлеченные параметры
    try {
      const paramsResponse = await fetch(`${API_BASE}/supplier-responses/${testResponse.id}/parameters`);
      
      if (paramsResponse.ok) {
        const paramsData = await paramsResponse.json();
        console.log('✅ Извлеченные параметры получены');
        console.log('Статус:', paramsData.status);
        
        if (paramsData.parameters) {
          console.log('\nПараметры:');
          Object.keys(paramsData.parameters).forEach(paramName => {
            const value = paramsData.parameters[paramName];
            console.log(`  - ${paramName}: ${value}`);
          });
        }
      } else if (paramsResponse.status === 404) {
        console.log('❌ Извлеченные параметры не найдены');
      } else {
        console.log('⚠️ Ошибка получения параметров:', paramsResponse.status);
      }
    } catch (error) {
      console.log('❌ Ошибка при запросе параметров:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testAttachmentProcessing().then(() => {
  console.log('\n🏁 Тестирование завершено');
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
