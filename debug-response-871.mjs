/**
 * Отладка конкретного ответа ID 871 из скриншота
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function debugResponse871() {
  console.log('🔍 Отладка ответа ID 871...\n');
  
  const responseId = 871;
  
  try {
    // Проверяем, доступен ли сервер
    console.log('🌐 Проверка доступности сервера...');
    try {
      const healthResponse = await fetch(`${API_BASE}/health`, { timeout: 5000 });
      console.log(`✅ Сервер отвечает (статус: ${healthResponse.status})`);
    } catch (error) {
      console.log(`❌ Сервер недоступен: ${error.message}`);
      return;
    }
    
    // Получаем информацию о конкретном ответе
    console.log(`\n📧 Получение информации об ответе ${responseId}...`);
    try {
      const response = await fetch(`${API_BASE}/supplier-responses/${responseId}`);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Ответ получен:');
        console.log(`   ID: ${responseData.id}`);
        console.log(`   Поставщик: ${responseData.supplierEmail}`);
        console.log(`   Тема: ${responseData.subject}`);
        console.log(`   Вложений: ${responseData.attachments ? responseData.attachments.length : 0}`);
        
        if (responseData.attachments && responseData.attachments.length > 0) {
          console.log('\n📎 Вложения:');
          responseData.attachments.forEach((attachment, index) => {
            console.log(`   ${index + 1}. ${attachment.filename}`);
            console.log(`      - Размер: ${attachment.size} байт`);
            console.log(`      - Тип: ${attachment.contentType}`);
            console.log(`      - Извлеченный текст: ${attachment.extractedText ? 'Да' : 'Нет'}`);
            if (attachment.extractedText) {
              console.log(`      - Длина: ${attachment.extractedText.length} символов`);
              console.log(`      - Превью: ${attachment.extractedText.substring(0, 150)}...`);
            }
          });
        }
        
        // Проверяем извлеченные параметры
        console.log('\n🔍 Проверка извлеченных параметров...');
        try {
          const paramsResponse = await fetch(`${API_BASE}/supplier-responses/${responseId}/parameters`);
          
          if (paramsResponse.ok) {
            const paramsData = await paramsResponse.json();
            console.log('✅ Параметры найдены:');
            console.log(`   Статус: ${paramsData.status}`);
            console.log(`   Дата извлечения: ${paramsData.extractionDate}`);
            
            if (paramsData.parameters) {
              console.log('\n📊 Параметры:');
              Object.keys(paramsData.parameters).forEach(paramName => {
                const value = paramsData.parameters[paramName];
                console.log(`   - ${paramName}: ${value}`);
              });
            }
          } else if (paramsResponse.status === 404) {
            console.log('❌ Извлеченные параметры не найдены');
          } else {
            console.log(`⚠️ Ошибка получения параметров: ${paramsResponse.status}`);
          }
        } catch (error) {
          console.log(`❌ Ошибка при запросе параметров: ${error.message}`);
        }
        
      } else if (response.status === 404) {
        console.log('❌ Ответ с ID 871 не найден');
      } else {
        console.log(`❌ Ошибка получения ответа: ${response.status}`);
        const errorText = await response.text();
        console.log('Ошибка:', errorText);
      }
    } catch (error) {
      console.log(`❌ Ошибка при запросе ответа: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error);
  }
}

// Запускаем отладку
debugResponse871().then(() => {
  console.log('\n🏁 Отладка завершена');
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
