# 🧪 Руководство по тестированию SupplierFinder

## 📋 Обзор

Этот документ содержит полное руководство по тестированию приложения SupplierFinder для подготовки к продакшну.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
# Установка всех зависимостей
npm install

# Установка только тестовых зависимостей
npm install --save-dev vitest @playwright/test @testing-library/react @testing-library/jest-dom
```

### 2. Настройка тестового окружения

```bash
# Копируем пример переменных окружения
cp env.test.example .env.test

# Настраиваем тестовую базу данных
npm run test:setup

# Проверяем настройки
npm run test:imports
```

### 3. Запуск тестов

```bash
# Все тесты
npm run test

# Модульные тесты
npm run test:unit

# Интеграционные тесты
npm run test:integration

# E2E тесты
npm run test:e2e

# Тесты производительности
npm run test:performance

# Тесты безопасности
npm run test:security

# Покрытие кода
npm run test:coverage
```

## 📁 Структура тестирования

```
tests/
├── setup/                 # Настройка тестового окружения
│   ├── test-environment.ts
│   ├── setup-test-db.js
│   └── cleanup-test-db.js
├── unit/                  # Модульные тесты
│   ├── api/              # API endpoints
│   ├── auth/             # Аутентификация
│   ├── components/        # React компоненты
│   └── services/          # Бизнес-логика
├── integration/          # Интеграционные тесты
│   ├── database/         # База данных
│   ├── email/           # Email сервисы
│   └── external/        # Внешние API
├── e2e/                 # End-to-End тесты
│   └── user-journey.test.ts
├── performance/         # Тесты производительности
│   └── load.test.ts
├── security/            # Тесты безопасности
│   └── security.test.ts
└── utils/               # Утилиты для тестирования
    ├── test-helpers.ts
    ├── mocks.ts
    └── fixtures.ts
```

## 🎯 Типы тестов

### 1. Модульные тесты (Unit Tests)

Тестируют отдельные компоненты и функции в изоляции.

**Примеры:**
- API endpoints
- Бизнес-логика
- React компоненты
- Утилиты и сервисы

**Запуск:**
```bash
npm run test:unit
```

### 2. Интеграционные тесты (Integration Tests)

Тестируют взаимодействие между компонентами.

**Примеры:**
- База данных интеграция
- Email сервисы
- AI интеграции
- Внешние API

**Запуск:**
```bash
npm run test:integration
```

### 3. End-to-End тесты (E2E Tests)

Тестируют полные пользовательские сценарии.

**Примеры:**
- Регистрация и вход
- Создание поискового запроса
- Поиск поставщиков
- Отправка запросов

**Запуск:**
```bash
npm run test:e2e
```

### 4. Тесты производительности (Performance Tests)

Тестируют производительность и масштабируемость.

**Примеры:**
- Нагрузочное тестирование
- Тестирование памяти
- Тестирование БД
- Тестирование API

**Запуск:**
```bash
npm run test:performance
```

### 5. Тесты безопасности (Security Tests)

Тестируют безопасность приложения.

**Примеры:**
- SQL injection
- XSS атаки
- CSRF защита
- Rate limiting
- Аутентификация

**Запуск:**
```bash
npm run test:security
```

## 🔧 Конфигурация

### Vitest (Unit & Integration Tests)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/test-environment.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### Playwright (E2E Tests)

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
```

## 📊 Метрики качества

### Покрытие кода

- **Цель**: 80% покрытие кода
- **Критический код**: 90% покрытие
- **Команды**:
  ```bash
  npm run test:coverage
  ```

### Производительность

- **Время ответа API**: < 500ms
- **Время загрузки страницы**: < 2s
- **Использование памяти**: < 200MB
- **Время запуска**: < 10s

### Безопасность

- **Все уязвимости**: 0 критических
- **Аутентификация**: 100% защищено
- **Авторизация**: 100% защищено
- **Валидация**: 100% входных данных

## 🚨 Troubleshooting

### Проблемы с тестовой БД

```bash
# Очистка тестовой БД
npm run test:cleanup

# Пересоздание тестовой БД
npm run test:setup
```

### Проблемы с зависимостями

```bash
# Очистка node_modules
rm -rf node_modules package-lock.json
npm install

# Установка только тестовых зависимостей
npm install --save-dev vitest @playwright/test
```

### Проблемы с портами

```bash
# Проверка занятых портов
lsof -i :5000
lsof -i :5001

# Освобождение портов
kill -9 $(lsof -t -i:5000)
kill -9 $(lsof -t -i:5001)
```

## 📈 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:setup
      - run: npm run test:all
      - run: npm run test:coverage
```

### Docker

```dockerfile
# Dockerfile.test
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run test:setup
CMD ["npm", "run", "test:all"]
```

## 📝 Лучшие практики

### 1. Написание тестов

- **AAA Pattern**: Arrange, Act, Assert
- **Изоляция**: Каждый тест независим
- **Читаемость**: Понятные названия и описания
- **Покрытие**: Тестируйте критический код

### 2. Управление данными

- **Фикстуры**: Используйте тестовые данные
- **Очистка**: Очищайте после каждого теста
- **Изоляция**: Не зависьте от других тестов

### 3. Производительность

- **Параллельность**: Запускайте тесты параллельно
- **Кэширование**: Используйте кэш для зависимостей
- **Оптимизация**: Минимизируйте время выполнения

## 🎯 Следующие шаги

### ЭТАП 2: Модульное тестирование
- [ ] API endpoints тестирование
- [ ] Бизнес-логика тестирование
- [ ] React компоненты тестирование
- [ ] Утилиты и сервисы тестирование

### ЭТАП 3: Интеграционное тестирование
- [ ] База данных интеграция
- [ ] Email сервисы интеграция
- [ ] AI сервисы интеграция
- [ ] Внешние API интеграция

### ЭТАП 4: End-to-End тестирование
- [ ] Пользовательские сценарии
- [ ] Критические пути
- [ ] UI/UX тестирование
- [ ] Кроссбраузерное тестирование

### ЭТАП 5: Тестирование производительности
- [ ] Нагрузочное тестирование
- [ ] Тестирование масштабируемости
- [ ] Оптимизация производительности
- [ ] Мониторинг ресурсов

### ЭТАП 6: Тестирование безопасности
- [ ] Аутентификация и авторизация
- [ ] CSRF и XSS защита
- [ ] SQL injection тестирование
- [ ] Rate limiting тестирование

### ЭТАП 7: Подготовка к продакшну
- [ ] Финальные проверки
- [ ] Документация
- [ ] Мониторинг и логирование
- [ ] Деплой стратегия

## 📞 Поддержка

Если у вас возникли проблемы с тестированием:

1. Проверьте логи тестов
2. Убедитесь, что все зависимости установлены
3. Проверьте настройки тестового окружения
4. Обратитесь к документации

---

**Готовы к следующему этапу?** Давайте перейдем к **ЭТАПУ 2: Модульное тестирование**! 🚀


