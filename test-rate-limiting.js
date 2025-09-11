// 🧪 Тест Rate Limiting для SupplierFinder
// Этот скрипт тестирует работу rate limiting middleware

const http = require('http');

// Настройки для тестирования
const SERVER_HOST = 'localhost';
const SERVER_PORT = 5000;
const TEST_ENDPOINT = '/api/auth/login';

// Функция для отправки HTTP запроса
function sendRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: TEST_ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Основная функция тестирования
async function testRateLimiting() {
  console.log('🧪 Начинаем тестирование Rate Limiting...\n');
  
  const testData = {
    username: 'test@example.com',
    password: 'wrongpassword'
  };

  try {
    // Тест 1: Первые 5 попыток (должны пройти)
    console.log('📝 Тест 1: Отправляем первые 5 попыток входа...');
    
    for (let i = 1; i <= 5; i++) {
      try {
        const response = await sendRequest(testData);
        console.log(`   Попытка ${i}: Статус ${response.statusCode}`);
        
        if (response.statusCode === 429) {
          console.log(`   ⚠️  Rate limiting сработал раньше времени на попытке ${i}`);
        }
      } catch (error) {
        console.log(`   ❌ Ошибка на попытке ${i}: ${error.message}`);
      }
      
      // Небольшая пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Тест 2: 6-я попытка (должна быть заблокирована)
    console.log('\n📝 Тест 2: Отправляем 6-ю попытку (должна быть заблокирована)...');
    
    try {
      const response = await sendRequest(testData);
      console.log(`   Попытка 6: Статус ${response.statusCode}`);
      
      if (response.statusCode === 429) {
        console.log('   ✅ Rate limiting работает! Попытка заблокирована.');
        
        // Парсим ответ для получения информации о блокировке
        try {
          const responseBody = JSON.parse(response.body);
          console.log(`   📋 Сообщение: ${responseBody.error}`);
          if (responseBody.retryAfter) {
            console.log(`   ⏰ Повторить через: ${responseBody.retryAfter} секунд`);
          }
        } catch (parseError) {
          console.log(`   📋 Ответ сервера: ${response.body}`);
        }
      } else {
        console.log('   ❌ Rate limiting не сработал! Попытка не заблокирована.');
      }
    } catch (error) {
      console.log(`   ❌ Ошибка на 6-й попытке: ${error.message}`);
    }

    console.log('\n🎯 Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

// Запускаем тест
testRateLimiting();
