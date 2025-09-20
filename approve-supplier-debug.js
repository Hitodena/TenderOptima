// Скрипт для отладки одобрения поставщика
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function approveSupplierDebug() {
  try {
    console.log('🔍 Получаем список поставщиков на модерацию...');
    
    const stagingResponse = await fetch(`${BASE_URL}/api/admin-test/staging-suppliers`);
    const stagingData = await stagingResponse.json();
    
    if (stagingData.data && stagingData.data.length > 0) {
      const firstSupplier = stagingData.data[0];
      console.log(`📋 Пытаемся одобрить поставщика: ${firstSupplier.rawTitle} (ID: ${firstSupplier.id})`);
      console.log(`   Поисковый запрос: "${firstSupplier.searchQuery}"`);
      console.log(`   URL: ${firstSupplier.rawUrl}`);
      
      console.log('\n🚀 Отправляем запрос на одобрение...');
      const approveResponse = await fetch(`${BASE_URL}/api/admin/approve-supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagingId: firstSupplier.id })
      });
      
      console.log(`📡 Ответ сервера: ${approveResponse.status} ${approveResponse.statusText}`);
      
      const responseText = await approveResponse.text();
      console.log(`📄 Тело ответа: ${responseText}`);
      
      if (approveResponse.ok) {
        try {
          const approveData = JSON.parse(responseText);
          console.log(`✅ Поставщик успешно одобрен!`);
          console.log(`   Данные ответа:`, approveData);
        } catch (parseError) {
          console.log(`⚠️  Ответ не является JSON: ${responseText}`);
        }
      } else {
        console.log(`❌ Ошибка одобрения: ${approveResponse.status}`);
        console.log(`   Детали: ${responseText}`);
      }
      
      // Проверим статус через несколько секунд
      console.log('\n⏳ Ждем 2 секунды и проверяем статус...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const checkResponse = await fetch(`${BASE_URL}/api/admin-test/staging-suppliers`);
      const checkData = await checkResponse.json();
      
      const updatedRecord = checkData.data.find(record => record.id === firstSupplier.id);
      if (updatedRecord) {
        console.log(`📊 Обновленный статус записи ${firstSupplier.id}: ${updatedRecord.status}`);
      } else {
        console.log(`❌ Запись ${firstSupplier.id} не найдена после обновления`);
      }
    } else {
      console.log('📭 Нет поставщиков на модерацию');
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

approveSupplierDebug();
