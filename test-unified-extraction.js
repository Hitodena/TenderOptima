// Test script to verify unified parameter extraction
const axios = require('axios');

async function testParameterExtraction() {
  try {
    console.log('🧪 Testing unified parameter extraction...');
    
    // Test data - simulate the invoice from your example
    const testText = `
    Счет на оплату № 511 от 11 июня 2025 г.
    
    Поставщик: ООО "ТЕХНОЛОГИИ БУДУЩЕГО"
    ИНН: 7733250318
    
    Товары (работы, услуги):
    1. 50мм круг/76 РР (диаметр/втулка), термотрансферная этикетка полипропиленовая белая
    Кол-во: 800 000 шт
    Цена: 0,25 руб.
    Сумма: 197 280,00 руб.
    
    Итого: 197 280,00 руб.
    В том числе НДС 20%: 32 880,00 руб.
    Всего к оплате: 197 280,00 руб.
    
    Срок производства: 8-10 рабочих дней после 100% предоплаты
    `;
    
    // Test parameters
    const parameters = [
      'общая стоимость без ндс',
      'общая стоимость с ндс', 
      'цена за единицу без ндс'
    ];
    
    console.log('📋 Testing parameters:', parameters);
    console.log('📄 Test text preview:', testText.substring(0, 200) + '...');
    
    // Call the extraction API
    const response = await axios.post('http://localhost:5000/api/extract-parameters', {
      responseId: 999, // Mock response ID
      parameters: parameters,
      useAI: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Note: You might need to add auth headers here
      }
    });
    
    console.log('✅ API Response:', response.data);
    
    // Check results
    const extractedParams = response.data.parameters || [];
    console.log('\n📊 Extracted Parameters:');
    
    extractedParams.forEach(param => {
      console.log(`  ${param.name}: "${param.value}" (confidence: ${param.confidence}, source: ${param.source})`);
    });
    
    // Validate expected results
    const expectedResults = {
      'общая стоимость без ндс': '164 400,00 руб.', // 197280 - 32880
      'общая стоимость с ндс': '197 280,00 руб.',
      'цена за единицу без ндс': '0,21 руб. за шт' // (197280 - 32880) / 800000
    };
    
    console.log('\n🎯 Expected Results:');
    Object.entries(expectedResults).forEach(([param, expected]) => {
      const found = extractedParams.find(p => p.name === param);
      const actual = found ? found.value : 'NOT FOUND';
      const match = actual.includes(expected.split(' ')[0]) || expected.includes(actual.split(' ')[0]);
      console.log(`  ${param}: ${match ? '✅' : '❌'} Expected: "${expected}", Got: "${actual}"`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testParameterExtraction();
