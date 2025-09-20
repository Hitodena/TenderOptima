// Запуск сервера в тестовом режиме
process.env.NODE_ENV = 'development';
process.env.DEV_MODE = 'true';
process.env.SKIP_AUTH = 'true';

console.log('🚀 Запуск сервера в тестовом режиме...');
console.log('✅ Переменные окружения:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   DEV_MODE: ${process.env.DEV_MODE}`);
console.log(`   SKIP_AUTH: ${process.env.SKIP_AUTH}`);

// Импортируем и запускаем сервер
import('./server/index.js');
