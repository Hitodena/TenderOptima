// Тест алгоритма ключевых слов
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testKeywordAlgorithm() {
  try {
    console.log('🔍 Тестируем алгоритм ключевых слов...');
    
    // Создадим простой тест, который проверит, работает ли наш алгоритм
    // через внутренний API (если есть такой)
    
    console.log('1️⃣ Проверяем, есть ли поставщик "Kufar" в базе данных...');
    
    const suppliersResponse = await fetch(`${BASE_URL}/api/suppliers`);
    const suppliers = await suppliersResponse.json();
    
    const kufarSupplier = suppliers.find(s => s.name === 'Kufar');
    if (kufarSupplier) {
      console.log(`✅ Найден поставщик Kufar (ID: ${kufarSupplier.id})`);
      console.log(`   Website: ${kufarSupplier.website}`);
      console.log(`   Description: ${kufarSupplier.description}`);
    } else {
      console.log('❌ Поставщик Kufar не найден');
    }
    
    console.log('\n2️⃣ Проверяем, есть ли поставщик "Bydom" в базе данных...');
    
    const bydomSupplier = suppliers.find(s => s.name === 'Bydom');
    if (bydomSupplier) {
      console.log(`✅ Найден поставщик Bydom (ID: ${bydomSupplier.id})`);
      console.log(`   Website: ${bydomSupplier.website}`);
      console.log(`   Description: ${bydomSupplier.description}`);
    } else {
      console.log('❌ Поставщик Bydom не найден');
    }
    
    console.log('\n3️⃣ Проверяем, есть ли поставщик "Partnerpack" в базе данных...');
    
    const partnerpackSupplier = suppliers.find(s => s.name === 'Partnerpack');
    if (partnerpackSupplier) {
      console.log(`✅ Найден поставщик Partnerpack (ID: ${partnerpackSupplier.id})`);
      console.log(`   Website: ${partnerpackSupplier.website}`);
      console.log(`   Description: ${partnerpackSupplier.description}`);
    } else {
      console.log('❌ Поставщик Partnerpack не найден');
    }
    
    console.log('\n4️⃣ Проверяем, есть ли поставщик "Tenderoptima" в базе данных...');
    
    const tenderoptimaSupplier = suppliers.find(s => s.name === 'Tenderoptima');
    if (tenderoptimaSupplier) {
      console.log(`✅ Найден поставщик Tenderoptima (ID: ${tenderoptimaSupplier.id})`);
      console.log(`   Website: ${tenderoptimaSupplier.website}`);
      console.log(`   Description: ${tenderoptimaSupplier.description}`);
    } else {
      console.log('❌ Поставщик Tenderoptima не найден');
    }
    
    console.log('\n📊 Итого поставщиков в базе данных:', suppliers.length);
    
    // Теперь попробуем найти способ протестировать наш алгоритм
    console.log('\n5️⃣ Попробуем протестировать алгоритм через внутренний API...');
    
    // Попробуем использовать внутренний API для поиска
    try {
      const internalSearchResponse = await fetch(`${BASE_URL}/api/internal/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: "поддоны купить",
          useDbSearch: true,
          useApiSearch: false,
          userId: 1
        })
      });
      
      if (internalSearchResponse.ok) {
        const results = await internalSearchResponse.json();
        console.log(`🔍 Результаты внутреннего поиска:`);
        console.log(`   Найдено: ${results.length} результатов`);
        
        if (results.length > 0) {
          console.log('\n📋 Результаты:');
          results.slice(0, 5).forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.name} (score: ${result.matchScore || 'N/A'})`);
            if (result.matchDetails) {
              if (result.matchDetails.keywordMatch) {
                console.log(`      🎯 KEYWORD MATCH: ${result.matchDetails.matchedKeyword}`);
              }
              if (result.matchDetails.partialKeywordMatch) {
                console.log(`      🔍 PARTIAL KEYWORD MATCH`);
              }
            }
          });
        }
      } else {
        console.log('❌ Внутренний API поиска недоступен');
      }
    } catch (error) {
      console.log('❌ Ошибка внутреннего API:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  }
}

testKeywordAlgorithm();
