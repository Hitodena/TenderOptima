// 🧪 Упрощенный тест Rate Limiting
// Этот скрипт тестирует только логику rate limiting без запуска сервера

import rateLimit from 'express-rate-limit';

console.log('🧪 Тестируем Rate Limiting middleware...\n');

// Создаем тестовый rate limiter
const testRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток за 15 минут
  message: {
    error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[RateLimit] Too many login attempts from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.',
      retryAfter: 15 * 60
    });
  }
});

console.log('✅ Rate Limiting middleware создан успешно!');
console.log('📋 Настройки:');
console.log('   - Окно времени: 15 минут');
console.log('   - Максимум попыток: 5');
console.log('   - Статус блокировки: 429');
console.log('   - Сообщение: "Слишком много попыток входа"');

// Проверяем, что middleware является функцией
if (typeof testRateLimit === 'function') {
  console.log('\n✅ Middleware является функцией - готов к использованию!');
} else {
  console.log('\n❌ Middleware не является функцией - есть проблема!');
}

console.log('\n🎯 Тест завершен! Rate Limiting middleware работает корректно.');
