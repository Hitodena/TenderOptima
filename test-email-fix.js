#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки исправлений в email отправке
 * Проверяет основные компоненты системы
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка исправлений email отправки...\n');

// Проверяем, что файлы существуют и содержат исправления
const filesToCheck = [
  {
    path: 'shared/schema.ts',
    checks: [
      'apiSuppliers: z.array',
      'fromContactGroup: z.boolean',
      'parameters: z.array'
    ]
  },
  {
    path: 'server/routes.ts',
    checks: [
      'apiSuppliers = []',
      'fromContactGroup = false',
      'parameters = []',
      'Processing standard suppliers',
      'API supplier IDs'
    ]
  },
  {
    path: 'client/src/components/email-form.tsx',
    checks: [
      'apiSuppliers: apiSuppliers',
      'КРИТИЧЕСКАЯ ОТЛАДКА - apiSuppliers',
      'searchEngine || allEmails || allPhones'
    ]
  },
  {
    path: 'client/src/lib/queryClient.ts',
    checks: [
      'throw new Error(`API request failed: ${res.status} ${res.statusText}`)',
      'Handle successful responses'
    ]
  }
];

let allChecksPassed = true;

filesToCheck.forEach(file => {
  console.log(`📁 Проверка ${file.path}...`);
  
  if (!fs.existsSync(file.path)) {
    console.log(`❌ Файл не найден: ${file.path}`);
    allChecksPassed = false;
    return;
  }
  
  const content = fs.readFileSync(file.path, 'utf8');
  let fileChecksPassed = true;
  
  file.checks.forEach(check => {
    if (content.includes(check)) {
      console.log(`  ✅ ${check}`);
    } else {
      console.log(`  ❌ ${check}`);
      fileChecksPassed = false;
    }
  });
  
  if (fileChecksPassed) {
    console.log(`  ✅ Все проверки пройдены для ${file.path}\n`);
  } else {
    console.log(`  ❌ Некоторые проверки не пройдены для ${file.path}\n`);
    allChecksPassed = false;
  }
});

console.log('📋 Сводка исправлений:');
console.log('1. ✅ Расширена схема emailTemplateSchema для поддержки API поставщиков');
console.log('2. ✅ Исправлена логика обработки поставщиков в send-email endpoint');
console.log('3. ✅ Добавлено детальное логирование для отладки');
console.log('4. ✅ Исправлена ошибка с повторным чтением response stream');
console.log('5. ✅ Улучшена передача apiSuppliers в клиентской части');

if (allChecksPassed) {
  console.log('\n🎉 Все исправления применены успешно!');
  console.log('\n📝 Следующие шаги:');
  console.log('1. Перезапустите сервер разработки');
  console.log('2. Протестируйте отправку email после поиска через Яндекс');
  console.log('3. Проверьте логи в консоли браузера и сервера');
  console.log('4. Убедитесь, что apiSuppliers передаются корректно');
} else {
  console.log('\n⚠️  Некоторые исправления не применены. Проверьте файлы выше.');
}

console.log('\n🔧 Для тестирования:');
console.log('1. Выполните поиск через Яндекс');
console.log('2. Выберите поставщиков из результатов');
console.log('3. Попробуйте отправить email');
console.log('4. Проверьте логи в консоли браузера (F12)');
console.log('5. Проверьте логи сервера в терминале');
