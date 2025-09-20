// Тестовый скрипт для проверки универсального поиска с ключевыми словами
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testUniversalSearch() {
  try {
    console.log('🔍 Тестируем универсальный поиск с ключевыми словами...');
    
    const searchQuery = {
      query: "поддоны купить",
      options: {
        maxResults: 10,
        includeStats: true
      }
    };
    
    console.log('🚀 Выполняем универсальный поиск...');
    const searchResponse = await fetch(`${BASE_URL}/api/universal-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchQuery)
    });
    
    if (searchResponse.ok) {
      const searchResults = await searchResponse.json();
      console.log(`🔍 Результаты универсального поиска:`);
      console.log(`   Найдено поставщиков: ${searchResults.results.length}`);
      
      if (searchResults.results && searchResults.results.length > 0) {
        console.log('\n📋 Все результаты:');
        searchResults.results.forEach((supplier, index) => {
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
            if (supplier.matchDetails.explanation) {
              console.log(`      📖 Explanation: ${supplier.matchDetails.explanation}`);
            }
          }
        });
        
        // Проверим, есть ли поставщик с высоким score
        const highScoreSuppliers = searchResults.results.filter(s => s.matchScore >= 2.0);
        if (highScoreSuppliers.length > 0) {
          console.log(`\n🎯 УСПЕХ! Найдено ${highScoreSuppliers.length} поставщиков с высоким score (>= 2.0):`);
          highScoreSuppliers.forEach(supplier => {
            console.log(`   - ${supplier.name} (score: ${supplier.matchScore})`);
            if (supplier.matchDetails.keywordMatch) {
              console.log(`     🎯 KEYWORD MATCH: ${supplier.matchDetails.matchedKeyword}`);
            }
          });
          console.log(`\n✅ Интеграция ключевых слов работает!`);
        } else {
          console.log(`\n⚠️  Не найдено поставщиков с высоким score (>= 2.0)`);
          console.log(`   Возможно, ключевые слова еще не связаны или есть проблема с алгоритмом`);
        }
        
        // Покажем статистику
        if (searchResults.stats) {
          console.log(`\n📊 Статистика поиска:`);
          console.log(`   Время обработки: ${searchResults.stats.processingTime}ms`);
          console.log(`   Стратегии: ${Object.keys(searchResults.stats.strategiesUsed).join(', ')}`);
        }
      } else {
        console.log('❌ Результаты поиска пусты');
      }
    } else {
      const errorData = await searchResponse.json();
      console.log(`❌ Ошибка поиска: ${searchResponse.status} - ${errorData.error}`);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testUniversalSearch();
