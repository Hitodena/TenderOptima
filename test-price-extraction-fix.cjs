// Тест для проверки исправления извлечения цен
const { extractParameterFromText } = require('./server/routes/extract-parameters.ts');

// Тестовый текст из документа (примерно как он может быть извлечен)
const testText = `
ООО «ПК «Маркет»
ИНН: 7713471291
КПП: 771301001

Коммерческое предложение

№ | Наименование | Кол-во | Единица измерения | Цена без НДС, руб/1эт | Цена без НДС, руб/рол | Сумма без НДС, руб
1 | Этикетка самоклеящаяся ПП круг 50мм (2000)76вт | 400 | рол | 0,16 | 320 | 128000

Всего наименований: 1, на сумму 128000 рублей без НДС.
Предложение действительно до 20 июня 2025 г.
Предоплата 100%.
Срок изготовления ориентировочно 7-10 рабочих дней после оплаты.
`;

async function testPriceExtraction() {
  console.log('🧪 Тестирование исправления извлечения цен...');
  
  const parameters = [
    'Общая стоимость без НДС',
    'Общая стоимость с НДС', 
    'Цена за единицу без НДС',
    'Условия оплаты',
    'Сроки поставки',
    'Наименование поставщика',
    'ИНН / УНП'
  ];
  
  console.log('📄 Тестовый текст:');
  console.log(testText);
  console.log('\n' + '─'.repeat(80) + '\n');
  
  for (const param of parameters) {
    console.log(`🔍 Извлечение параметра: "${param}"`);
    
    try {
      const result = extractParameterFromText(testText, param);
      console.log(`   Результат: "${result.value}"`);
      console.log(`   Уверенность: ${result.confidence}`);
      console.log(`   Источник: ${result.source}`);
      
      // Проверяем, что не извлекается ИНН как цена
      if (param.includes('стоимость') || param.includes('цена')) {
        if (result.value.includes('7713471291')) {
          console.log('   ❌ ОШИБКА: ИНН извлечен как цена!');
        } else {
          console.log('   ✅ Правильно: ИНН не используется как цена');
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('🏁 Тест завершен');
}

// Запускаем тест
testPriceExtraction().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
