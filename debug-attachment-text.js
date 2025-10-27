// Скрипт для отладки извлечения текста из вложений
const { storage } = require('./server/storage');

async function debugAttachmentText() {
  console.log('🔍 Отладка извлечения текста из вложений...');
  
  try {
    // Получаем последние ответы с вложениями
    const responses = await storage.getSupplierResponses({ limit: 10 });
    const responsesWithAttachments = responses.filter(r => 
      r.attachments && Array.isArray(r.attachments) && r.attachments.length > 0
    );
    
    console.log(`📊 Найдено ${responsesWithAttachments.length} ответов с вложениями`);
    
    if (responsesWithAttachments.length === 0) {
      console.log('❌ Нет ответов с вложениями для отладки');
      return;
    }
    
    // Берем первый ответ для отладки
    const testResponse = responsesWithAttachments[0];
    console.log(`🔍 Отладка ответа ID: ${testResponse.id}`);
    console.log(`📎 Вложений: ${testResponse.attachments.length}`);
    
    // Показываем извлеченный текст из каждого вложения
    testResponse.attachments.forEach((attachment, index) => {
      console.log(`\n📄 Вложение ${index + 1}: ${attachment.filename}`);
      console.log(`📊 Размер: ${attachment.size} байт`);
      console.log(`📝 Извлеченный текст (${attachment.extractedText?.length || 0} символов):`);
      console.log('─'.repeat(80));
      
      if (attachment.extractedText) {
        // Показываем первые 1000 символов
        const preview = attachment.extractedText.substring(0, 1000);
        console.log(preview);
        if (attachment.extractedText.length > 1000) {
          console.log('... (текст сокращен)');
        }
        
        // Ищем цены в тексте
        console.log('\n💰 Найденные цены в тексте:');
        const pricePatterns = [
          /(\d[\d\s.,]+)\s*(?:руб|₽|BYN|USD|\$|EUR|€)/gi,
          /цена[:\s]*(\d[\d\s.,]+)/gi,
          /стоимость[:\s]*(\d[\d\s.,]+)/gi,
          /сумма[:\s]*(\d[\d\s.,]+)/gi,
          /итого[:\s]*(\d[\d\s.,]+)/gi
        ];
        
        pricePatterns.forEach((pattern, i) => {
          const matches = attachment.extractedText.match(pattern);
          if (matches) {
            console.log(`  Паттерн ${i + 1}: ${matches.slice(0, 5).join(', ')}`);
          }
        });
        
        // Ищем конкретные значения из документа
        console.log('\n🎯 Поиск конкретных значений:');
        const specificValues = [
          '128000',
          '0,16',
          '320',
          '128.000',
          '128 000'
        ];
        
        specificValues.forEach(value => {
          if (attachment.extractedText.includes(value)) {
            console.log(`  ✅ Найдено: ${value}`);
          } else {
            console.log(`  ❌ Не найдено: ${value}`);
          }
        });
        
      } else {
        console.log('❌ Текст не извлечен из вложения');
      }
      console.log('─'.repeat(80));
    });
    
  } catch (error) {
    console.error('❌ Ошибка отладки:', error);
  }
}

// Запускаем отладку
debugAttachmentText().then(() => {
  console.log('🏁 Отладка завершена');
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
