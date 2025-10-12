#!/usr/bin/env node

/**
 * Мониторинг логов в реальном времени
 * Помогает поймать ошибки при сне компьютера
 */

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔍 Мониторинг логов в реальном времени...');
console.log('💡 Переведите компьютер в сон и разбудите его для воспроизведения ошибок\n');

// Функция для проверки ошибок в логах
function checkForErrors() {
  const logFiles = [
    'attachment_analyzer.log',
    'file_processing.log', 
    'logs/security.log'
  ];

  let foundErrors = false;

  logFiles.forEach(logFile => {
    if (fs.existsSync(logFile)) {
      try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        // Ищем ошибки за последние 5 минут
        const recentErrors = lines.filter(line => {
          const hasError = line.includes('ERROR') || 
                          line.includes('CRITICAL') || 
                          line.includes('ECONNRESET') ||
                          line.includes('Connection terminated') ||
                          line.includes('WebSocket connection error') ||
                          line.includes('Cannot use a pool after calling end');
          
          // Проверяем, что ошибка не старше 5 минут
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
          
          // Простая проверка времени (если в логе есть время)
          const timeMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
          if (timeMatch) {
            const logTime = new Date(timeMatch[1]);
            const isRecent = logTime > fiveMinutesAgo;
            return hasError && isRecent;
          }
          
          return hasError;
        });
        
        if (recentErrors.length > 0) {
          foundErrors = true;
          console.log(`\n❌ ОШИБКИ В ${logFile}:`);
          recentErrors.forEach(error => {
            console.log(`   ${error}`);
          });
        }
        
      } catch (error) {
        console.log(`❌ Ошибка чтения ${logFile}: ${error.message}`);
      }
    }
  });

  return foundErrors;
}

// Функция для проверки процессов Node.js
async function checkNodeProcesses() {
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
    const lines = stdout.split('\n').filter(line => line.includes('node.exe'));
    return lines.length - 1;
  } catch (error) {
    return 0;
  }
}

// Функция для проверки сетевых соединений
async function checkNetworkConnections() {
  try {
    const { stdout } = await execAsync('netstat -ano | findstr :5000');
    const lines = stdout.split('\n').filter(line => line.trim());
    
    const listening = lines.filter(line => line.includes('LISTENING')).length;
    const established = lines.filter(line => line.includes('ESTABLISHED')).length;
    const closing = lines.filter(line => line.includes('TIME_WAIT') || line.includes('FIN_WAIT')).length;
    
    return { listening, established, closing, total: lines.length };
  } catch (error) {
    return { listening: 0, established: 0, closing: 0, total: 0 };
  }
}

// Основной цикл мониторинга
async function startMonitoring() {
  let iteration = 0;
  
  console.log('🚀 Запуск мониторинга...\n');
  
  const interval = setInterval(async () => {
    iteration++;
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] Проверка #${iteration}...`);
    
    // Проверяем ошибки в логах
    const hasErrors = checkForErrors();
    
    // Проверяем процессы
    const nodeProcesses = await checkNodeProcesses();
    console.log(`   📊 Node.js процессов: ${nodeProcesses}`);
    
    // Проверяем сетевые соединения
    const connections = await checkNetworkConnections();
    console.log(`   🌐 Соединений: слушает=${connections.listening}, активных=${connections.established}, закрывающихся=${connections.closing}`);
    
    if (hasErrors) {
      console.log('\n🚨 ОБНАРУЖЕНЫ ОШИБКИ! Проверьте логи выше.');
    } else {
      console.log('   ✅ Ошибок не найдено');
    }
    
    console.log(''); // Пустая строка для читаемости
    
    // Останавливаем мониторинг через 10 минут
    if (iteration >= 20) {
      clearInterval(interval);
      console.log('⏰ Мониторинг завершен (10 минут)');
    }
    
  }, 30000); // Проверяем каждые 30 секунд
  
  // Обработка Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Остановка мониторинга...');
    clearInterval(interval);
    process.exit(0);
  });
}

// Запуск мониторинга
startMonitoring().catch(console.error);
