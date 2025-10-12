#!/usr/bin/env node

/**
 * Тест стабильности сервера после исправлений
 * Проверяет, что сервер не падает при различных операциях
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5000';
const TEST_DURATION = 30000; // 30 секунд
const REQUEST_INTERVAL = 1000; // 1 секунда между запросами

console.log('🧪 Тестирование стабильности сервера...\n');

let requestCount = 0;
let errorCount = 0;
let startTime = Date.now();

async function makeRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.message || 'Unknown error'}`);
    }
    
    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runStabilityTest() {
  console.log('🚀 Запуск теста стабильности...');
  console.log(`⏱️  Длительность: ${TEST_DURATION / 1000} секунд`);
  console.log(`🔄 Интервал запросов: ${REQUEST_INTERVAL}ms\n`);
  
  const testEndpoints = [
    { endpoint: '/api/health', method: 'GET' },
    { endpoint: '/api/requests', method: 'GET' },
    { endpoint: '/api/csrf-token', method: 'GET' },
  ];
  
  const interval = setInterval(async () => {
    requestCount++;
    const endpoint = testEndpoints[requestCount % testEndpoints.length];
    
    console.log(`📡 Запрос #${requestCount}: ${endpoint.method} ${endpoint.endpoint}`);
    
    const result = await makeRequest(endpoint.endpoint, endpoint.method);
    
    if (result.success) {
      console.log(`   ✅ Успех (${result.status})`);
    } else {
      errorCount++;
      console.log(`   ❌ Ошибка: ${result.error}`);
    }
    
    // Проверяем, не истекло ли время теста
    if (Date.now() - startTime >= TEST_DURATION) {
      clearInterval(interval);
      printResults();
    }
  }, REQUEST_INTERVAL);
  
  // Обработка прерывания
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n🛑 Тест прерван пользователем');
    printResults();
    process.exit(0);
  });
}

function printResults() {
  const duration = (Date.now() - startTime) / 1000;
  const successRate = ((requestCount - errorCount) / requestCount * 100).toFixed(2);
  
  console.log('\n📊 Результаты теста стабильности:');
  console.log(`   Всего запросов: ${requestCount}`);
  console.log(`   Успешных: ${requestCount - errorCount}`);
  console.log(`   Ошибок: ${errorCount}`);
  console.log(`   Время выполнения: ${duration.toFixed(2)} секунд`);
  console.log(`   Успешность: ${successRate}%`);
  
  if (errorCount === 0) {
    console.log('\n🎉 Отлично! Сервер стабилен, ошибок не обнаружено');
  } else if (errorCount < requestCount * 0.1) {
    console.log('\n⚠️  Хорошо! Сервер в основном стабилен, есть несколько ошибок');
  } else {
    console.log('\n❌ Проблема! Обнаружено много ошибок, сервер нестабилен');
  }
  
  console.log('\n💡 Рекомендации:');
  if (errorCount > 0) {
    console.log('   - Проверьте логи сервера на наличие ошибок');
    console.log('   - Убедитесь, что база данных доступна');
    console.log('   - Проверьте настройки подключения');
  } else {
    console.log('   - Сервер работает стабильно');
    console.log('   - Можно переходить к тестированию функциональности');
  }
}

// Запуск теста
runStabilityTest().catch(console.error);
