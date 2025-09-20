// Устанавливаем переменные окружения для тестирования
process.env.NODE_ENV = 'development';
process.env.DEV_MODE = 'true';
process.env.SKIP_AUTH = 'true';

console.log('✅ Установлены переменные окружения для тестирования:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   DEV_MODE: ${process.env.DEV_MODE}`);
console.log(`   SKIP_AUTH: ${process.env.SKIP_AUTH}`);

// Теперь запускаем тест
import('./test-moderation-simple.js');