// Тест для проверки переменных окружения
require('dotenv').config({ path: '.env' });
console.log('Проверяем переменные окружения:');
console.log('DEV_MODE:', process.env.DEV_MODE);
console.log('SKIP_AUTH:', process.env.SKIP_AUTH);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Установлен' : 'Не установлен');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);
