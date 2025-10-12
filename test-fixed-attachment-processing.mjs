/**
 * Тест исправленной обработки вложений
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function testFixedAttachmentProcessing() {
  console.log('🔧 Тестирование исправленной обработки вложений...\n');
  
  try {
    // Проверяем, что сервер работает
    console.log('🌐 Проверка доступности сервера...');
    try {
      const healthResponse = await fetch(`${API_BASE}/health`, { timeout: 5000 });
      console.log(`✅ Сервер отвечает (статус: ${healthResponse.status})`);
    } catch (error) {
      console.log(`❌ Сервер недоступен: ${error.message}`);
      return;
    }
    
    // Получаем список ответов с вложениями
    console.log('\n📧 Получение ответов с вложениями...');
    const responsesResponse = await fetch(`${API_BASE}/supplier-responses?limit=5`);
    
    if (!responsesResponse.ok) {
      console.log('❌ Не удалось получить список ответов:', responsesResponse.status);
      return;
    }
    
    const responses = await responsesResponse.json();
    
    if (!responses || responses.length === 0) {
      console.log('❌ Нет ответов для тестирования');
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
        console.log(`     - Длина: ${attachment.extractedText.length} символов`);
        console.log(`     - Превью: ${attachment.extractedText.substring(0, 100)}...`);
      }
    });
    
    console.log('\n🔍 Проверка извлеченных параметров...');
    
    // Проверяем извлеченные параметры
    try {
      const paramsResponse = await fetch(`${API_BASE}/supplier-responses/${testResponse.id}/parameters`);
      
      if (paramsResponse.ok) {
        const paramsData = await paramsResponse.json();
        console.log('✅ Извлеченные параметры получены');
        console.log('Статус:', paramsData.status);
        console.log('Дата извлечения:', paramsData.extractionDate);
        
        if (paramsData.parameters) {
          console.log('\n📊 Параметры:');
          Object.keys(paramsData.parameters).forEach(paramName => {
            const value = paramsData.parameters[paramName];
            console.log(`  - ${paramName}: ${value}`);
          });
          
          // Проверяем, есть ли параметры из вложений
          const hasAttachmentParams = Object.values(paramsData.parameters).some(val => 
            val && val !== '-' && val !== 'Не указано'
          );
          
          if (hasAttachmentParams) {
            console.log('\n✅ Параметры успешно извлечены из вложений!');
          } else {
            console.log('\n⚠️ Параметры не извлечены из вложений');
          }
        }
      } else if (paramsResponse.status === 404) {
        console.log('❌ Извлеченные параметры не найдены');
      } else {
        console.log(`⚠️ Ошибка получения параметров: ${paramsResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ Ошибка при запросе параметров: ${error.message}`);
    }
    
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
      console.log(`❌ Ошибка при запросе обработки вложений: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testFixedAttachmentProcessing().then(() => {
  console.log('\n🏁 Тестирование завершено');
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
