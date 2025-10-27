const nodemailer = require('nodemailer');
require('dotenv').config({ path: './env.dev' });

console.log('=== ПРОВЕРКА КОНФИГУРАЦИИ EMAIL ===');
console.log('SMTP_HOST:', process.env.SMTP_HOST || 'НЕ УСТАНОВЛЕН');
console.log('SMTP_PORT:', process.env.SMTP_PORT || 'НЕ УСТАНОВЛЕН');
console.log('SMTP_USER:', process.env.SMTP_USER || 'НЕ УСТАНОВЛЕН');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'УСТАНОВЛЕН' : 'НЕ УСТАНОВЛЕН');

if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.log('\n❌ ОШИБКА: Не все SMTP настройки установлены!');
  console.log('Для исправления:');
  console.log('1. Откройте файл env.dev');
  console.log('2. Замените значения SMTP_* на реальные настройки вашей почты');
  console.log('3. Для Gmail используйте:');
  console.log('   SMTP_HOST=smtp.gmail.com');
  console.log('   SMTP_PORT=587');
  console.log('   SMTP_USER=ваш-gmail@gmail.com');
  console.log('   SMTP_PASS=ваш-пароль-приложения');
  console.log('\n4. Перезапустите сервер');
  process.exit(1);
}

console.log('\n✅ Все SMTP настройки установлены');
console.log('\n=== ТЕСТ ПОДКЛЮЧЕНИЯ К SMTP ===');

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Ошибка подключения к SMTP:', error.message);
    console.log('\nВозможные причины:');
    console.log('1. Неправильные учетные данные');
    console.log('2. Для Gmail нужно включить "Менее безопасные приложения" или использовать пароль приложения');
    console.log('3. Блокировка файрволом');
  } else {
    console.log('✅ SMTP подключение успешно!');
    console.log('Сервер готов к отправке email');
  }
});
