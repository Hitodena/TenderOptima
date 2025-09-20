// Прямой тест алгоритма сопоставления
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { suppliers, supplierSearchKeywords } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Импортируем MatchingService
import { MatchingService } from './server/matching-service.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/supplierfinder';

async function testDirectMatching() {
  try {
    console.log('🔍 Прямой тест алгоритма сопоставления...');
    
    const sql = postgres(connectionString, { max: 1 });
    const db = drizzle(sql, { schema: { suppliers, supplierSearchKeywords } });
    
    // Получаем всех поставщиков
    const allSuppliers = await db.select().from(suppliers);
    console.log(`📊 Найдено ${allSuppliers.length} поставщиков в базе данных`);
    
    if (allSuppliers.length === 0) {
      console.log('❌ Нет поставщиков в базе данных');
      return;
    }
    
    // Получаем ключевые слова
    const allKeywords = await db.select().from(supplierSearchKeywords);
    console.log(`📊 Найдено ${allKeywords.length} ключевых слов`);
    
    if (allKeywords.length > 0) {
      console.log('\n📋 Ключевые слова:');
      allKeywords.forEach(kw => {
        console.log(`   - Supplier ID ${kw.supplierId}: "${kw.keyword}"`);
      });
    }
    
    // Создаем тестовый запрос
    const searchRequest = {
      productName: "поддоны купить",
      productDescription: "Тестовый поиск",
      useDbSearch: true,
      useApiSearch: false,
      userId: 1
    };
    
    console.log('\n🚀 Запускаем алгоритм сопоставления...');
    const matchingService = new MatchingService();
    const matches = await matchingService.matchSuppliers(allSuppliers, searchRequest);
    
    console.log(`\n🔍 Результаты сопоставления:`);
    console.log(`   Найдено совпадений: ${matches.length}`);
    
    if (matches.length > 0) {
      console.log('\n📋 Топ-5 результатов:');
      matches.slice(0, 5).forEach((supplier, index) => {
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
      const highScoreSuppliers = matches.filter(s => s.matchScore >= 2.0);
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
      console.log('❌ Нет совпадений');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testDirectMatching();
