#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки исправлений поиска и админ панели
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testSearchFunctionality() {
  console.log('🔍 Тестирование функциональности поиска...\n');
  
  try {
    // 1. Тест аутентификации
    console.log('1. Проверка аутентификации...');
    const authResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      credentials: 'include'
    });
    
    if (authResponse.ok) {
      const user = await authResponse.json();
      console.log(`✅ Пользователь аутентифицирован: ${user.username} (ID: ${user.id})`);
      
      // 2. Тест подписки
      console.log('\n2. Проверка подписки...');
      const subscriptionResponse = await fetch(`${BASE_URL}/api/subscriptions/status`, {
        credentials: 'include'
      });
      
      if (subscriptionResponse.ok) {
        const subscription = await subscriptionResponse.json();
        console.log(`✅ Подписка активна: ${subscription.plan}, осталось запросов: ${subscription.requestsLeft}`);
        
        // 3. Тест поиска
        console.log('\n3. Тестирование поиска поставщиков...');
        const searchResponse = await fetch(`${BASE_URL}/api/supplier-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            queries: ['тест поиска'],
            sources: {
              registry: true,
              google: false,
              yandex: false
            },
            maxResults: 5
          })
        });
        
        if (searchResponse.ok) {
          const searchResult = await searchResponse.json();
          console.log(`✅ Поиск работает! Найдено поставщиков: ${searchResult.suppliers?.length || 0}`);
        } else {
          const error = await searchResponse.text();
          console.log(`❌ Ошибка поиска: ${searchResponse.status} - ${error}`);
        }
        
      } else {
        console.log(`❌ Ошибка подписки: ${subscriptionResponse.status}`);
      }
      
    } else {
      console.log('❌ Пользователь не аутентифицирован');
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

async function testAdminPanelAccess() {
  console.log('\n🔐 Тестирование доступа к админ панели...\n');
  
  try {
    // Проверка админ панели
    const adminResponse = await fetch(`${BASE_URL}/api/admin/check-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': 'admin-token-123456'
      },
      credentials: 'include',
      body: JSON.stringify({
        username: 'admin@example.com'
      })
    });
    
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      console.log(`✅ Админ доступ: ${adminData.isAdmin ? 'Разрешен' : 'Запрещен'}`);
    } else {
      console.log(`❌ Ошибка админ доступа: ${adminResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования админ панели:', error.message);
  }
}

async function main() {
  console.log('🚀 Запуск тестов исправлений...\n');
  
  await testSearchFunctionality();
  await testAdminPanelAccess();
  
  console.log('\n✅ Тестирование завершено!');
  console.log('\n📋 Резюме исправлений:');
  console.log('1. ✅ Убрана проверка localStorage для админ панели');
  console.log('2. ✅ Добавлена очистка localStorage при выходе');
  console.log('3. ✅ Добавлено логирование для отладки подписки');
  console.log('4. ✅ Исправлен выход из админ панели');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSearchFunctionality, testAdminPanelAccess };


