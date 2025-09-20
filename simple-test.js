// Простой тест для проверки работы алгоритма
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function simpleTest() {
  try {
    console.log('🔍 Простой тест интеграции ключевых слов...');
    
    // Проверим, есть ли поставщики в базе данных
    console.log('1️⃣ Проверяем поставщиков в базе данных...');
    
    // Попробуем получить поставщиков через API (если есть такой эндпоинт)
    try {
      const suppliersResponse = await fetch(`${BASE_URL}/api/suppliers`);
      if (suppliersResponse.ok) {
        const suppliers = await suppliersResponse.json();
        console.log(`📊 Найдено ${suppliers.length} поставщиков в базе данных`);
        
        if (suppliers.length > 0) {
          console.log('\n📋 Первые 5 поставщиков:');
          suppliers.slice(0, 5).forEach((supplier, index) => {
            console.log(`   ${index + 1}. ${supplier.name} (ID: ${supplier.id})`);
          });
        }
      } else {
        console.log('❌ Не удалось получить поставщиков через API');
      }
    } catch (error) {
      console.log('❌ Ошибка получения поставщиков:', error.message);
    }
    
    // Проверим, есть ли ключевые слова
    console.log('\n2️⃣ Проверяем ключевые слова...');
    
    // Попробуем найти поставщика с ключевым словом "поддоны купить"
    // через поиск в базе данных (если есть такой эндпоинт)
    try {
      const searchResponse = await fetch(`${BASE_URL}/api/db-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: "поддоны купить",
          useDbSearch: true,
          useApiSearch: false
        })
      });
      
      if (searchResponse.ok) {
        const results = await searchResponse.json();
        console.log(`🔍 Результаты поиска в базе данных:`);
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
        console.log('❌ Не удалось выполнить поиск в базе данных');
      }
    } catch (error) {
      console.log('❌ Ошибка поиска в базе данных:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  }
}

simpleTest();
