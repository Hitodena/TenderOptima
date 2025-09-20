// Скрипт для проверки одобренных поставщиков
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function checkApprovedSuppliers() {
  try {
    console.log('🔍 Проверяем все записи в staging_suppliers...');
    
    const stagingResponse = await fetch(`${BASE_URL}/api/admin-test/staging-suppliers`);
    const stagingData = await stagingResponse.json();
    
    if (stagingData.data && stagingData.data.length > 0) {
      console.log(`📊 Всего записей: ${stagingData.data.length}`);
      
      // Группируем по статусам
      const statusGroups = {};
      stagingData.data.forEach(record => {
        statusGroups[record.status] = (statusGroups[record.status] || 0) + 1;
      });
      
      console.log('\n📊 Статистика по статусам:');
      Object.entries(statusGroups).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      
      // Показываем записи с разными статусами
      console.log('\n📋 Примеры записей:');
      stagingData.data.slice(0, 5).forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.rawTitle} - статус: ${record.status}`);
        console.log(`      Поисковый запрос: "${record.searchQuery}"`);
        console.log(`      ID: ${record.id}`);
      });
      
      // Ищем записи со статусом 'approved'
      const approvedRecords = stagingData.data.filter(record => record.status === 'approved');
      if (approvedRecords.length > 0) {
        console.log(`\n✅ Найдено ${approvedRecords.length} одобренных записей:`);
        approvedRecords.forEach(record => {
          console.log(`   - ${record.rawTitle} (ID: ${record.id})`);
          console.log(`     Поисковый запрос: "${record.searchQuery}"`);
        });
      } else {
        console.log('\n⚠️  Нет одобренных записей');
      }
    } else {
      console.log('📭 Нет данных в staging_suppliers');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

checkApprovedSuppliers();
