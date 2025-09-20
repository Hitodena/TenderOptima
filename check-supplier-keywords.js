// Скрипт для проверки поставщика и его ключевых слов
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function checkSupplierKeywords() {
  try {
    console.log('🔍 Проверяем поставщика и его ключевые слова...');
    
    // Попробуем найти поставщика через поиск
    const searchQuery = {
      query: "поддоны купить",
      useDbSearch: true,
      useApiSearch: false,
      userId: 1
    };
    
    console.log('🚀 Выполняем поиск по ключевому слову "поддоны купить"...');
    const searchResponse = await fetch(`${BASE_URL}/api/supplier-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchQuery)
    });
    
    if (searchResponse.ok) {
      const searchResults = await searchResponse.json();
      console.log(`🔍 Результаты поиска:`);
      console.log(`   Найдено поставщиков: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        console.log('\n📋 Все результаты:');
        searchResults.forEach((supplier, index) => {
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
        
        // Проверим, есть ли поставщик с высоким score
        const highScoreSuppliers = searchResults.filter(s => s.matchScore >= 2.0);
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

checkSupplierKeywords();
