/**
 * Мониторинг обработки вложений в реальном времени
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function monitorAttachmentProcessing() {
  console.log('🔍 Мониторинг обработки вложений...\n');
  
  // Создаем тестовое письмо с вложением
  console.log('📧 Создание тестового письма...');
  
  const testEmail = {
    from: 'test@example.com',
    subject: 'Тестовое письмо с вложением',
    content: 'Тестовое письмо с коммерческим предложением в приложении',
    attachments: [
      {
        filename: 'test-proposal.txt',
        contentType: 'text/plain',
        content: Buffer.from(`КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ

Товар: Картонные коробки
Количество: 1000 штук
Размер: 25x25x10 см

ЦЕНЫ:
- Цена за единицу без НДС: 150 рублей
- Общая стоимость без НДС: 150000 рублей
- Общая стоимость с НДС: 180000 рублей

УСЛОВИЯ:
- Сроки поставки: 14 дней
- Условия оплаты: 30% предоплата, 70% по факту поставки
- Гарантия: 12 месяцев

Поставщик: ООО "Тестовый поставщик"
Контактное лицо: Иванов Иван Иванович
Телефон: +7 (999) 123-45-67
Email: test@supplier.com`).toString('base64'),
        size: 500
      }
    ]
  };
  
  try {
    // Отправляем тестовое письмо (эмулируем получение)
    console.log('📤 Отправка тестового письма...');
    
    // Здесь мы не можем напрямую отправить письмо через IMAP,
    // но можем проверить, как работает обработка существующих писем
    
    console.log('🔍 Поиск существующих писем с вложениями...');
    
    // Получаем список ответов
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
    
    // Тестируем первый ответ
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
    
  } catch (error) {
    console.error('❌ Ошибка при мониторинге:', error);
  }
}

// Запускаем мониторинг
monitorAttachmentProcessing().then(() => {
  console.log('\n🏁 Мониторинг завершен');
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
