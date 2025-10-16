// Test script to verify structured response parsing improvements
const { extractParameterFromText } = require('./server/routes/extract-parameters');

// Test email content based on the image description
const testEmailContent = `Количество - 100 поддонов. Грузоподъемность (масса брутто) - До 1000 кг. Доставка - Минск (Тарасово)

>>>
1.Описание товара: — Поддон плоский деревянный четырехзаходний 1200х800 Б/У, по ГОСТ 33757—2016
2.Общая стоимость без НДС: — 800,00 руб.
3.Общая стоимость с НДС: 8,00 руб (работаем без НДС)
4. Цена за единицу без НДС: 8,00 руб
5. Условия оплаты: 100% предоплата
6.Сроки поставки: в течении 3-х рабочих дней с момента предоплаты
7. Наименование поставщика: ЧТУП «ПалетПакБел»
8.ИНН / УНП: 691774041
>>>`;

// Test parameters that should be extracted
const testParameters = [
  'общая стоимость без ндс',
  'общая стоимость с ндс', 
  'цена за единицу без ндс',
  'условия оплаты',
  'сроки поставки',
  'наименование поставщика',
  'инн / упн'
];

console.log('🧪 Testing structured response parsing improvements...\n');
console.log('📧 Test email content:');
console.log(testEmailContent);
console.log('\n' + '='.repeat(80) + '\n');

// Test each parameter
testParameters.forEach(param => {
  console.log(`\n🔍 Testing parameter: "${param}"`);
  try {
    const result = extractParameterFromText(testEmailContent, param);
    console.log(`   Result: "${result.value}"`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Source: ${result.source}`);
    
    if (result.value !== '-') {
      console.log(`   ✅ SUCCESS: Found value`);
    } else {
      console.log(`   ❌ FAILED: No value found`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('🏁 Test completed!');

