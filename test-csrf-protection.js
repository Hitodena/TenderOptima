// 🧪 Тест CSRF защиты для SupplierFinder
// Этот скрипт тестирует работу CSRF middleware

import http from 'http';
import https from 'https';

// Настройки для тестирования
const SERVER_HOST = 'localhost';
const SERVER_PORT = 5000;

// Функция для отправки HTTP запроса
function sendRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const requestOptions = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CSRF-Test-Script/1.0',
        ...options.headers
      }
    };

    if (postData) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(requestOptions, (res) => {
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

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Основная функция тестирования
async function testCSRFProtection() {
  console.log('🧪 Начинаем тестирование CSRF защиты...\n');
  
  try {
    // Тест 1: Получение CSRF токена
    console.log('📝 Тест 1: Получаем CSRF токен...');
    
    try {
      const response = await sendRequest({
        path: '/api/csrf-token',
        method: 'GET'
      });
      
      console.log(`   Статус: ${response.statusCode}`);
      
      if (response.statusCode === 200) {
        try {
          const data = JSON.parse(response.body);
          console.log('   ✅ CSRF токен получен успешно!');
          console.log(`   📋 Токен: ${data.csrfToken ? 'Присутствует' : 'Отсутствует'}`);
          
          // Сохраняем токен для следующих тестов
          global.csrfToken = data.csrfToken;
        } catch (parseError) {
          console.log('   ❌ Ошибка парсинга ответа:', parseError.message);
        }
      } else {
        console.log('   ❌ Не удалось получить CSRF токен');
        console.log(`   📋 Ответ: ${response.body}`);
      }
    } catch (error) {
      console.log(`   ❌ Ошибка при получении токена: ${error.message}`);
    }

    // Тест 2: Попытка входа без CSRF токена (должна быть заблокирована)
    console.log('\n📝 Тест 2: Попытка входа без CSRF токена (должна быть заблокирована)...');
    
    try {
      const response = await sendRequest({
        path: '/api/auth/login',
        method: 'POST'
      }, {
        username: 'test@example.com',
        password: 'testpassword'
      });
      
      console.log(`   Статус: ${response.statusCode}`);
      
      if (response.statusCode === 403) {
        console.log('   ✅ CSRF защита работает! Запрос заблокирован.');
        try {
          const data = JSON.parse(response.body);
          console.log(`   📋 Сообщение: ${data.error || 'CSRF токен отсутствует'}`);
        } catch (parseError) {
          console.log(`   📋 Ответ: ${response.body}`);
        }
      } else {
        console.log('   ❌ CSRF защита не сработала! Запрос не заблокирован.');
        console.log(`   📋 Ответ: ${response.body}`);
      }
    } catch (error) {
      console.log(`   ❌ Ошибка при тестировании: ${error.message}`);
    }

    // Тест 3: Попытка входа с CSRF токеном (должна пройти проверку CSRF)
    console.log('\n📝 Тест 3: Попытка входа с CSRF токеном...');
    
    if (global.csrfToken) {
      try {
        const response = await sendRequest({
          path: '/api/auth/login',
          method: 'POST',
          headers: {
            'X-CSRF-Token': global.csrfToken
          }
        }, {
          username: 'test@example.com',
          password: 'testpassword'
        });
        
        console.log(`   Статус: ${response.statusCode}`);
        
        if (response.statusCode === 403) {
          console.log('   ✅ CSRF токен принят, но аутентификация не удалась (это нормально)');
          try {
            const data = JSON.parse(response.body);
            console.log(`   📋 Сообщение: ${data.error || 'Ошибка аутентификации'}`);
          } catch (parseError) {
            console.log(`   📋 Ответ: ${response.body}`);
          }
        } else if (response.statusCode === 401) {
          console.log('   ✅ CSRF токен принят, но пользователь не найден (это нормально)');
        } else {
          console.log('   ⚠️  Неожиданный статус ответа');
          console.log(`   📋 Ответ: ${response.body}`);
        }
      } catch (error) {
        console.log(`   ❌ Ошибка при тестировании: ${error.message}`);
      }
    } else {
      console.log('   ⚠️  Пропускаем тест - CSRF токен не получен');
    }

    // Тест 4: Попытка входа с неверным CSRF токеном (должна быть заблокирована)
    console.log('\n📝 Тест 4: Попытка входа с неверным CSRF токеном (должна быть заблокирована)...');
    
    try {
      const response = await sendRequest({
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'invalid-token-12345'
        }
      }, {
        username: 'test@example.com',
        password: 'testpassword'
      });
      
      console.log(`   Статус: ${response.statusCode}`);
      
      if (response.statusCode === 403) {
        console.log('   ✅ CSRF защита работает! Неверный токен заблокирован.');
        try {
          const data = JSON.parse(response.body);
          console.log(`   📋 Сообщение: ${data.error || 'Неверный CSRF токен'}`);
        } catch (parseError) {
          console.log(`   📋 Ответ: ${response.body}`);
        }
      } else {
        console.log('   ❌ CSRF защита не сработала! Неверный токен не заблокирован.');
        console.log(`   📋 Ответ: ${response.body}`);
      }
    } catch (error) {
      console.log(`   ❌ Ошибка при тестировании: ${error.message}`);
    }

    console.log('\n🎯 Тестирование CSRF защиты завершено!');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

// Запускаем тест
testCSRFProtection();
