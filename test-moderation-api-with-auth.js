// Тестовый скрипт для проверки API модерации с аутентификацией
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Функция для получения токена авторизации
async function getAuthToken() {
  try {
    console.log('🔐 Получаем токен авторизации...');
    
    // Попробуем залогиниться (используйте реальные данные)
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@example.com', // Замените на реальные данные
        password: 'password123'        // Замените на реальные данные
      })
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      return loginData.token;
    } else {
      console.log('❌ Ошибка авторизации, попробуем без токена');
      return null;
    }
  } catch (error) {
    console.log('❌ Ошибка получения токена:', error.message);
    return null;
  }
}

async function testModerationAPI() {
  console.log('🧪 Тестирование API модерации с аутентификацией...\n');

  // Получаем токен
  const token = await getAuthToken();
  
  // Подготавливаем заголовки
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // 1. Тест получения списка на модерацию
    console.log('1️⃣ Тестируем GET /api/admin/staging-suppliers');
    const stagingResponse = await fetch(`${BASE_URL}/api/admin/staging-suppliers`, {
      headers
    });
    
    if (stagingResponse.ok) {
      const stagingData = await stagingResponse.json();
      console.log(`✅ Получено ${stagingData.total} записей на модерацию`);
      
      if (stagingData.data && stagingData.data.length > 0) {
        const firstRecord = stagingData.data[0];
        console.log(`📋 Первая запись: ${firstRecord.rawTitle} (${firstRecord.rawUrl})`);
        console.log(`🔍 Дубликат: ${firstRecord.isDuplicate ? 'Да' : 'Нет'}`);
        
        // 2. Тест одобрения поставщика (если есть записи)
        if (!firstRecord.isDuplicate) {
          console.log('\n2️⃣ Тестируем POST /api/admin/approve-supplier');
          const approveResponse = await fetch(`${BASE_URL}/api/admin/approve-supplier`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ stagingId: firstRecord.id })
          });
          
          if (approveResponse.ok) {
            const approveData = await approveResponse.json();
            console.log(`✅ Поставщик одобрен: ${approveData.data.supplierName}`);
          } else {
            const errorData = await approveResponse.json();
            console.log(`❌ Ошибка одобрения: ${approveResponse.status} - ${errorData.error}`);
          }
        } else {
          console.log('\n2️⃣ Пропускаем тест одобрения (запись является дубликатом)');
        }
        
        // 3. Тест отклонения (берем следующую запись, если есть)
        if (stagingData.data.length > 1) {
          const secondRecord = stagingData.data[1];
          console.log('\n3️⃣ Тестируем POST /api/admin/reject-supplier');
          const rejectResponse = await fetch(`${BASE_URL}/api/admin/reject-supplier`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ stagingId: secondRecord.id })
          });
          
          if (rejectResponse.ok) {
            const rejectData = await rejectResponse.json();
            console.log(`✅ Поставщик отклонен: ${rejectData.data.supplierName}`);
          } else {
            const errorData = await rejectResponse.json();
            console.log(`❌ Ошибка отклонения: ${rejectResponse.status} - ${errorData.error}`);
          }
        }
        
      } else {
        console.log('📭 Нет записей на модерацию');
      }
      
    } else {
      const errorData = await stagingResponse.json();
      console.log(`❌ Ошибка получения списка: ${stagingResponse.status} - ${errorData.error}`);
      
      if (stagingResponse.status === 401) {
        console.log('💡 Подсказка: Убедитесь, что сервер запущен и у вас есть активная сессия');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

// Запускаем тесты
testModerationAPI();
