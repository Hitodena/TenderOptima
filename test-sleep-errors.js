#!/usr/bin/env node

/**
 * Тест для воспроизведения ошибок при сне компьютера
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🧪 Тест воспроизведения ошибок при сне компьютера...\n');

// Функция для проверки IMAP соединений
async function checkImapConnections() {
  console.log('📧 Проверка IMAP соединений...');
  
  try {
    // Проверяем, есть ли процессы, связанные с IMAP
    const { stdout } = await execAsync('netstat -ano | findstr :993');
    const lines = stdout.split('\n').filter(line => line.trim());
    
    if (lines.length > 0) {
      console.log(`   🔗 IMAP соединений: ${lines.length}`);
      lines.forEach(line => console.log(`   ${line}`));
    } else {
      console.log('   ℹ️  IMAP соединений не найдено');
    }
  } catch (error) {
    console.log(`   ❌ Ошибка проверки IMAP: ${error.message}`);
  }
}

// Функция для проверки WebSocket соединений
async function checkWebSocketConnections() {
  console.log('\n🌐 Проверка WebSocket соединений...');
  
  try {
    const { stdout } = await execAsync('netstat -ano | findstr :5000');
    const lines = stdout.split('\n').filter(line => line.trim());
    
    const listening = lines.filter(line => line.includes('LISTENING'));
    const established = lines.filter(line => line.includes('ESTABLISHED'));
    const closing = lines.filter(line => line.includes('TIME_WAIT') || line.includes('FIN_WAIT'));
    
    console.log(`   📊 Всего соединений: ${lines.length}`);
    console.log(`   ✅ Слушает: ${listening.length}`);
    console.log(`   🔗 Активных: ${established.length}`);
    console.log(`   ⚠️  Закрывающихся: ${closing.length}`);
    
    if (closing.length > 0) {
      console.log('   ⚠️  Обнаружены закрывающиеся соединения - возможная проблема!');
      closing.forEach(line => console.log(`      ${line}`));
    }
    
  } catch (error) {
    console.log(`   ❌ Ошибка проверки WebSocket: ${error.message}`);
  }
}

// Функция для проверки процессов Node.js
async function checkNodeProcesses() {
  console.log('\n🔍 Проверка процессов Node.js...');
  
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
    const lines = stdout.split('\n').filter(line => line.includes('node.exe'));
    
    console.log(`   📊 Найдено процессов: ${lines.length - 1}`);
    
    lines.forEach((line, index) => {
      if (index > 0 && line.trim()) {
        const parts = line.split(',');
        if (parts.length >= 5) {
          const pid = parts[1].replace(/"/g, '');
          const memory = parts[4].replace(/"/g, '');
          const cpu = parts[2].replace(/"/g, '');
          console.log(`   🔹 PID: ${pid}, Память: ${memory}, CPU: ${cpu}`);
        }
      }
    });
    
  } catch (error) {
    console.log(`   ❌ Ошибка проверки процессов: ${error.message}`);
  }
}

// Функция для тестирования API
async function testApi() {
  console.log('\n🧪 Тестирование API...');
  
  try {
    const { stdout } = await execAsync('curl -s -o nul -w "%{http_code}" http://localhost:5000/api/health');
    console.log(`   📡 Статус API: ${stdout}`);
    
    if (stdout === '200') {
      console.log('   ✅ API работает нормально');
    } else {
      console.log('   ⚠️  API может работать некорректно');
    }
    
  } catch (error) {
    console.log(`   ❌ Ошибка тестирования API: ${error.message}`);
  }
}

// Основная функция
async function main() {
  console.log('🚀 Запуск диагностики...\n');
  
  await checkNodeProcesses();
  await checkWebSocketConnections();
  await checkImapConnections();
  await testApi();
  
  console.log('\n💡 Инструкции для воспроизведения проблемы:');
  console.log('   1. Запустите этот скрипт: node test-sleep-errors.js');
  console.log('   2. Переведите компьютер в сон (Windows + L, затем выберите сон)');
  console.log('   3. Подождите 2-3 минуты');
  console.log('   4. Разбудите компьютер');
  console.log('   5. Запустите скрипт снова и сравните результаты');
  console.log('   6. Проверьте консоль браузера на ошибки');
  
  console.log('\n🔍 Ожидаемые проблемы при сне:');
  console.log('   - ECONNRESET ошибки в IMAP соединениях');
  console.log('   - WebSocket соединения могут разорваться');
  console.log('   - База данных может потерять соединение');
  console.log('   - Бесконечные циклы в консоли браузера');
}

main().catch(console.error);
