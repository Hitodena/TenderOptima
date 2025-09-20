// Тестовый скрипт для проверки интеграции ключевых слов в семантический поиск
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testKeywordIntegration() {
  console.log('🧪 Тестирование интеграции ключевых слов в семантический поиск...\n');

  try {
    // 1. Сначала проверим, есть ли одобренные поставщики с ключевыми словами
    console.log('1️⃣ Проверяем одобренные поставщики с ключевыми словами...');
    const stagingResponse = await fetch(`${BASE_URL}/api/admin-test/staging-suppliers`);
    
    if (stagingResponse.ok) {
      const stagingData = await stagingResponse.json();
      console.log(`📊 Найдено ${stagingData.total} записей в staging_suppliers`);
      
      if (stagingData.data && stagingData.data.length > 0) {
        // Найдем запись, которая была одобрена
        const approvedRecord = stagingData.data.find(record => record.status === 'approved');
        
        if (approvedRecord) {
          console.log(`✅ Найдена одобренная запись: ${approvedRecord.rawTitle} (ID: ${approvedRecord.id})`);
          console.log(`   Поисковый запрос: "${approvedRecord.searchQuery}"`);
          console.log(`   URL: ${approvedRecord.rawUrl}`);
          
          // 2. Теперь протестируем поиск по этому ключевому слову
          console.log('\n2️⃣ Тестируем поиск по одобренному ключевому слову...');
          
          const searchQuery = {
            productName: approvedRecord.searchQuery,
            productDescription: `Тестовый поиск для проверки интеграции ключевых слов`,
            useDbSearch: true,
            useApiSearch: false,
            userId: 1
          };
          
          const searchResponse = await fetch(`${BASE_URL}/api/supplier-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchQuery)
          });
          
          if (searchResponse.ok) {
            const searchResults = await searchResponse.json();
            console.log(`🔍 Результаты поиска по "${approvedRecord.searchQuery}":`);
            console.log(`   Найдено поставщиков: ${searchResults.length}`);
            
            if (searchResults.length > 0) {
              console.log('\n📋 Топ-5 результатов:');
              searchResults.slice(0, 5).forEach((supplier, index) => {
                console.log(`   ${index + 1}. ${supplier.name} (score: ${supplier.matchScore})`);
                if (supplier.matchDetails) {
                  if (supplier.matchDetails.keywordMatch) {
                    console.log(`      🎯 KEYWORD MATCH: ${supplier.matchDetails.matchedKeyword}`);
                  }
                  if (supplier.matchDetails.partialKeywordMatch) {
                    console.log(`      🔍 PARTIAL KEYWORD MATCH`);
                  }
                  if (supplier.matchDetails.matchedTerms) {
                    console.log(`      📝 Matched terms: ${supplier.matchDetails.matchedTerms.join(', ')}`);
                  }
                }
              });
              
              // Проверим, есть ли поставщик с высоким score (должен быть из-за keyword match)
              const highScoreSupplier = searchResults.find(s => s.matchScore >= 2.0);
              if (highScoreSupplier) {
                console.log(`\n🎯 УСПЕХ! Найден поставщик с высоким score (${highScoreSupplier.matchScore}): ${highScoreSupplier.name}`);
                console.log(`   Это означает, что интеграция ключевых слов работает!`);
              } else {
                console.log(`\n⚠️  Не найдено поставщиков с высоким score (>= 2.0)`);
                console.log(`   Возможно, ключевые слова еще не связаны с поставщиками`);
              }
            } else {
              console.log('❌ Результаты поиска пусты');
            }
          } else {
            const errorData = await searchResponse.json();
            console.log(`❌ Ошибка поиска: ${searchResponse.status} - ${errorData.error}`);
          }
        } else {
          console.log('⚠️  Не найдено одобренных записей. Сначала одобрите поставщика через API модерации.');
        }
      } else {
        console.log('📭 Нет данных в staging_suppliers');
      }
    } else {
      const errorData = await stagingResponse.json();
      console.log(`❌ Ошибка получения staging suppliers: ${stagingResponse.status} - ${errorData.error}`);
    }

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

// Запускаем тесты
testKeywordIntegration();
