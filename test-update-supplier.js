// Тестовый скрипт для проверки API обновления поставщика
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';
const ADMIN_TOKEN = 'admin-token-123456';

async function testUpdateSupplier() {
  console.log('✏️ Тестирование API обновления поставщика...\n');

  // Сначала найдем существующего поставщика
  console.log('1. Поиск поставщика для обновления:');
  let supplierId = null;
  try {
    const findResponse = await fetch(`${BASE_URL}/api/admin/suppliers/find?website=www.test.com`, {
      method: 'GET',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const findData = await findResponse.json();
    console.log(`   Статус: ${findResponse.status}`);
    
    if (findData.success && findData.data) {
      supplierId = findData.data.id;
      console.log(`   Найден поставщик с ID: ${supplierId}`);
    } else {
      console.log(`   Поставщик не найден:`, findData);
      return;
    }
  } catch (error) {
    console.log(`   Ошибка поиска:`, error.message);
    return;
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Тест 1: Успешное обновление
  console.log('2. Успешное обновление поставщика:');
  try {
    const updateData = {
      name: "Обновленная тестовая компания",
      description: "Обновленное описание тестовой компании",
      website: "www.test.com",
      email: "updated@test.com",
      phone: "+7 (999) 999-99-99",
      categories: ["обновленная", "категория", "тест"],
      region: "Москва, Санкт-Петербург",
      legalName: "ООО Обновленная Тест",
      taxId: "1294723491",
      legalAddress: "Обновленный адрес",
      bankDetails: "Обновленные банковские реквизиты",
      contactPerson: "Обновленный контакт"
    };

    const response = await fetch(`${BASE_URL}/api/admin/suppliers/${supplierId}`, {
      method: 'PUT',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Тест 2: Обновление несуществующего поставщика
  console.log('3. Обновление несуществующего поставщика:');
  try {
    const updateData = {
      name: "Тест",
      description: "Тест",
      website: "test.com",
      email: "test@test.com",
      phone: "+7 (999) 123-45-67",
      categories: ["тест"]
    };

    const response = await fetch(`${BASE_URL}/api/admin/suppliers/99999`, {
      method: 'PUT',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Тест 3: Невалидные данные
  console.log('4. Обновление с невалидными данными:');
  try {
    const updateData = {
      name: "", // Пустое имя
      description: "Тест",
      website: "test.com",
      email: "test@test.com",
      phone: "+7 (999) 123-45-67",
      categories: [] // Пустой массив категорий
    };

    const response = await fetch(`${BASE_URL}/api/admin/suppliers/${supplierId}`, {
      method: 'PUT',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Тест 4: Невалидный ID
  console.log('5. Обновление с невалидным ID:');
  try {
    const updateData = {
      name: "Тест",
      description: "Тест",
      website: "test.com",
      email: "test@test.com",
      phone: "+7 (999) 123-45-67",
      categories: ["тест"]
    };

    const response = await fetch(`${BASE_URL}/api/admin/suppliers/invalid`, {
      method: 'PUT',
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    console.log(`   Статус: ${response.status}`);
    console.log(`   Ответ:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   Ошибка:`, error.message);
  }
}

testUpdateSupplier().catch(console.error);
