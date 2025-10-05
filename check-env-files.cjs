#!/usr/bin/env node

/**
 * Скрипт для проверки, что все файлы используют .env вместо env.dev
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let hasEnvDev = false;
    let hasDotEnv = false;
    
    lines.forEach((line, index) => {
      if (line.includes('env.dev')) {
        hasEnvDev = true;
        console.log(`❌ ${filePath}:${index + 1} - ${line.trim()}`);
      }
      if (line.includes('.env')) {
        hasDotEnv = true;
      }
    });
    
    if (hasEnvDev) {
      console.log(`❌ ${filePath} - использует env.dev`);
      return false;
    } else if (hasDotEnv) {
      console.log(`✅ ${filePath} - использует .env`);
      return true;
    } else {
      console.log(`⚪ ${filePath} - не использует переменные окружения`);
      return true;
    }
  } catch (error) {
    console.log(`❌ ${filePath} - ошибка чтения: ${error.message}`);
    return false;
  }
}

function checkDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let allGood = true;
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      allGood = checkDirectory(filePath) && allGood;
    } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs') || file.endsWith('.ts')) {
      allGood = checkFile(filePath) && allGood;
    }
  });
  
  return allGood;
}

console.log('🔍 Проверка использования env.dev vs .env...\n');

const result = checkDirectory('.');

console.log('\n📋 РЕЗУЛЬТАТ:');
if (result) {
  console.log('✅ Все файлы используют правильные настройки окружения');
} else {
  console.log('❌ Найдены файлы, использующие env.dev');
}

console.log('\n💡 РЕКОМЕНДАЦИИ:');
console.log('1. Убедитесь, что в .env файле установлены:');
console.log('   DEV_MODE=false');
console.log('   SKIP_AUTH=false');
console.log('2. Перезапустите сервер после изменений');
console.log('3. Удалите файл env.dev, если он больше не нужен');
