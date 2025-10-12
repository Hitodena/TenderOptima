#!/usr/bin/env node

/**
 * Мониторинг логов сервера в реальном времени
 * Помогает отследить ошибки при сне компьютера
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔍 Мониторинг логов сервера...\n');

// Функция для мониторинга логов файлов
function monitorLogFiles() {
  const logFiles = [
    'attachment_analyzer.log',
    'file_processing.log',
    'logs/security.log'
  ];

  logFiles.forEach(logFile => {
    if (fs.existsSync(logFile)) {
      console.log(`📄 Мониторинг файла: ${logFile}`);
      
      // Читаем последние 10 строк
      try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        const lastLines = lines.slice(-10);
        
        console.log(`   Последние записи:`);
        lastLines.forEach(line => {
          if (line.includes('ERROR') || line.includes('CRITICAL')) {
            console.log(`   ❌ ${line}`);
          } else if (line.includes('WARN')) {
            console.log(`   ⚠️  ${line}`);
          } else {
            console.log(`   ℹ️  ${line}`);
          }
        });
        console.log('');
      } catch (error) {
        console.log(`   ❌ Ошибка чтения файла: ${error.message}`);
      }
    } else {
      console.log(`   ⚠️  Файл не найден: ${logFile}`);
    }
  });
}

// Функция для проверки процессов Node.js
function checkNodeProcesses() {
  console.log('🔍 Проверка процессов Node.js...');
  
  const { exec } = require('child_process');
  
  exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout, stderr) => {
    if (error) {
      console.log(`   ❌ Ошибка получения процессов: ${error.message}`);
      return;
    }
    
    const lines = stdout.split('\n').filter(line => line.includes('node.exe'));
    console.log(`   📊 Найдено процессов Node.js: ${lines.length - 1}`);
    
    lines.forEach((line, index) => {
      if (index > 0 && line.trim()) { // Пропускаем заголовок
        const parts = line.split(',');
        if (parts.length >= 2) {
          const pid = parts[1].replace(/"/g, '');
          const memory = parts[4] ? parts[4].replace(/"/g, '') : 'N/A';
          console.log(`   🔹 PID: ${pid}, Память: ${memory}`);
        }
      }
    });
    console.log('');
  });
}

// Функция для проверки сетевых соединений
function checkNetworkConnections() {
  console.log('🌐 Проверка сетевых соединений...');
  
  const { exec } = require('child_process');
  
  exec('netstat -ano | findstr :5000', (error, stdout, stderr) => {
    if (error) {
      console.log(`   ❌ Ошибка проверки портов: ${error.message}`);
      return;
    }
    
    const lines = stdout.split('\n').filter(line => line.trim());
    console.log(`   📊 Соединений на порту 5000: ${lines.length}`);
    
    lines.forEach(line => {
      if (line.includes('LISTENING')) {
        console.log(`   ✅ Сервер слушает: ${line.trim()}`);
      } else if (line.includes('ESTABLISHED')) {
        console.log(`   🔗 Активное соединение: ${line.trim()}`);
      } else if (line.includes('TIME_WAIT') || line.includes('FIN_WAIT')) {
        console.log(`   ⚠️  Закрывающееся соединение: ${line.trim()}`);
      }
    });
    console.log('');
  });
}

// Функция для проверки ошибок в Event Log
function checkEventLogs() {
  console.log('📋 Проверка системных логов...');
  
  const { exec } = require('child_process');
  
  exec('powershell "Get-EventLog -LogName Application -Newest 5 | Where-Object {$_.Message -like \'*node*\' -or $_.Message -like \'*5000*\'} | Select-Object TimeGenerated, EntryType, Message"', (error, stdout, stderr) => {
    if (error) {
      console.log(`   ℹ️  Нет ошибок Node.js в системных логах`);
    } else if (stdout.trim()) {
      console.log(`   ⚠️  Найдены записи в Event Log:`);
      console.log(`   ${stdout}`);
    } else {
      console.log(`   ✅ Нет ошибок в системных логах`);
    }
    console.log('');
  });
}

// Основная функция мониторинга
function startMonitoring() {
  console.log('🚀 Запуск мониторинга логов сервера...\n');
  
  // Первоначальная проверка
  monitorLogFiles();
  checkNodeProcesses();
  checkNetworkConnections();
  checkEventLogs();
  
  console.log('💡 Рекомендации для воспроизведения проблемы:');
  console.log('   1. Переведите компьютер в сон');
  console.log('   2. Разбудите компьютер');
  console.log('   3. Запустите этот скрипт снова для проверки логов');
  console.log('   4. Проверьте консоль браузера на ошибки');
  
  console.log('\n🔄 Мониторинг завершен. Запустите снова после сна компьютера.');
}

// Запуск мониторинга
startMonitoring();
