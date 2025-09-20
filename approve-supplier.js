// Скрипт для одобрения поставщика
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function approveSupplier() {
  try {
    console.log('🔍 Получаем список поставщиков на модерацию...');
    
    const stagingResponse = await fetch(`${BASE_URL}/api/admin-test/staging-suppliers`);
    const stagingData = await stagingResponse.json();
    
    if (stagingData.data && stagingData.data.length > 0) {
      const firstSupplier = stagingData.data[0];
      console.log(`📋 Одобряем поставщика: ${firstSupplier.rawTitle} (ID: ${firstSupplier.id})`);
      console.log(`   Поисковый запрос: "${firstSupplier.searchQuery}"`);
      
      const approveResponse = await fetch(`${BASE_URL}/api/admin/approve-supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagingId: firstSupplier.id })
      });
      
      if (approveResponse.ok) {
        const approveData = await approveResponse.json();
        console.log(`✅ Поставщик успешно одобрен!`);
        console.log(`   Создан supplier с ID: ${approveData.supplierId}`);
        console.log(`   Ключевое слово "${firstSupplier.searchQuery}" связано с поставщиком`);
      } else {
        const errorData = await approveResponse.json();
        console.log(`❌ Ошибка одобрения: ${approveResponse.status} - ${errorData.error}`);
      }
    } else {
      console.log('📭 Нет поставщиков на модерацию');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

approveSupplier();
