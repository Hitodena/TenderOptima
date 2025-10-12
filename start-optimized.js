#!/usr/bin/env node

/**
 * Быстрый запуск SupplierFinder с оптимизированными настройками
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Запуск SupplierFinder с оптимизированными настройками...\n');

// Проверяем наличие оптимизированного .env файла
const optimizedEnvPath = path.join(__dirname, '.env.optimized');
if (fs.existsSync(optimizedEnvPath)) {
  console.log('📋 Используем оптимизированные настройки из .env.optimized');
  // Копируем оптимизированный .env файл
  fs.copyFileSync(optimizedEnvPath, '.env');
} else {
  console.log('⚠️ Файл .env.optimized не найден, используем стандартные настройки');
}

// Настройки для оптимизации производительности
const nodeOptions = [
  '--max-old-space-size=2048',
  '--optimize-for-size',
  '--expose-gc'
];

// Запускаем сервер с оптимизированными настройками
const serverProcess = spawn('node', ['--loader', 'tsx/esm', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions.join(' '),
    NODE_ENV: 'development',
    ENABLE_EMAIL_CHECKING: 'false' // Отключаем для лучшей производительности
  }
});

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('\n🛑 Остановка сервера...');
  serverProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Остановка сервера...');
  serverProcess.kill('SIGTERM');
  process.exit(0);
});

serverProcess.on('close', (code) => {
  console.log(`\n✅ Сервер завершен с кодом ${code}`);
  process.exit(code);
});

serverProcess.on('error', (error) => {
  console.error('❌ Ошибка запуска сервера:', error);
  process.exit(1);
});
