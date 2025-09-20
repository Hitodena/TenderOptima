// Тестовый скрипт для проверки API поиска поставщика
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';
const ADMIN_TOKEN = 'admin-token-123456';

async function testFindSupplier() {
  console.log('🔍 Тестирование API поиска поставщика...\n');

  // Тест 1: Поиск по website
  console.log('1. Поиск по website:');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/suppliers/find?website=www.test.com`, {
      method: 'GET',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Тест 2: Поиск по taxId
  console.log('2. Поиск по taxId:');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/suppliers/find?taxId=1294723491`, {
      method: 'GET',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Тест 3: Поиск несуществующего поставщика
  console.log('3. Поиск несуществующего поставщика:');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/suppliers/find?website=nonexistent.com`, {
      method: 'GET',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Тест 4: Отсутствие параметров
  console.log('4. Отсутствие параметров поиска:');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/suppliers/find`, {
      method: 'GET',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }
}

testFindSupplier().catch(console.error);
