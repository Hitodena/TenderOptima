// Простой тестовый скрипт для проверки API модерации (без аутентификации)
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testModerationAPI() {
  console.log('🧪 Тестирование API модерации (тестовые роуты)...\n');

  try {
    // 1. Тест получения списка на модерацию
    console.log('1️⃣ Тестируем GET /api/admin-test/staging-suppliers');
    const stagingResponse = await fetch(`${BASE_URL}/api/admin-test/staging-suppliers`);
    
    if (stagingResponse.ok) {
      const stagingData = await stagingResponse.json();
      console.log(`✅ Получено ${stagingData.total} записей на модерацию`);
      
      if (stagingData.data && stagingData.data.length > 0) {
        const firstRecord = stagingData.data[0];
        console.log(`📋 Первая запись:`);
        console.log(`   ID: ${firstRecord.id}`);
        console.log(`   Название: ${firstRecord.rawTitle}`);
        console.log(`   URL: ${firstRecord.rawUrl}`);
        console.log(`   Поисковый запрос: ${firstRecord.searchQuery}`);
        console.log(`   Движок: ${firstRecord.sourceEngine}`);
        console.log(`   Регион: ${firstRecord.region}`);
        console.log(`   Email: ${firstRecord.rawEmails ? firstRecord.rawEmails.join(', ') : 'Нет'}`);
        console.log(`   Телефоны: ${firstRecord.rawPhones ? firstRecord.rawPhones.join(', ') : 'Нет'}`);
        console.log(`   Дубликат: ${firstRecord.isDuplicate ? 'Да' : 'Нет'}`);
        console.log(`   Статус: ${firstRecord.status}`);
        console.log(`   Создано: ${firstRecord.createdAt}`);
        
        if (stagingData.data.length > 1) {
          console.log(`\n📋 Всего записей: ${stagingData.data.length}`);
          console.log(`📊 Статистика:`);
          
          const stats = {
            total: stagingData.data.length,
            duplicates: stagingData.data.filter(r => r.isDuplicate).length,
            unique: stagingData.data.filter(r => !r.isDuplicate).length,
            byEngine: {}
          };
          
          stagingData.data.forEach(record => {
            stats.byEngine[record.sourceEngine] = (stats.byEngine[record.sourceEngine] || 0) + 1;
          });
          
          console.log(`   - Всего: ${stats.total}`);
          console.log(`   - Дубликаты: ${stats.duplicates}`);
          console.log(`   - Уникальные: ${stats.unique}`);
          console.log(`   - По движкам:`, stats.byEngine);
        }
        
      } else {
        console.log('📭 Нет записей на модерацию');
        console.log('💡 Попробуйте выполнить поиск поставщиков, чтобы создать записи в staging_suppliers');
      }
      
    } else {
      const errorData = await stagingResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.log(`❌ Ошибка получения списка: ${stagingResponse.status} - ${errorData.error}`);
      
      if (stagingResponse.status === 404) {
        console.log('💡 Подсказка: Убедитесь, что сервер запущен и роуты зарегистрированы');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    console.log('💡 Подсказка: Убедитесь, что сервер запущен на порту 5001');
  }
}

// Запускаем тесты
testModerationAPI();
