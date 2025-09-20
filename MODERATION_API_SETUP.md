# Настройка и использование API Модерации

## Проблема с аутентификацией

При тестировании API модерации возникает ошибка 401 (Unauthorized). Это происходит потому, что все эндпоинты требуют аутентификации.

## Решения

### 1. Использование переменных окружения (Рекомендуется для разработки)

Создайте файл `.env` в корне проекта со следующими переменными:

```env
NODE_ENV=development
DEV_MODE=true
SKIP_AUTH=true
```

Затем перезапустите сервер:
```bash
npm run dev
```

### 2. Использование админ-токена

Добавьте заголовок `x-admin-token` со значением `admin-token-123456`:

```bash
curl -H "x-admin-token: admin-token-123456" http://localhost:5001/api/admin/staging-suppliers
```

### 3. Использование Bearer токена

Получите токен через `/api/auth/login` и используйте его:

```bash
# Получение токена
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-email@example.com","password":"your-password"}'

# Использование токена
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5001/api/admin/staging-suppliers
```

## Тестовые эндпоинты

Для тестирования без аутентификации доступны следующие эндпоинты:

- `GET /api/admin-test/staging-suppliers` - получение списка на модерацию
- `GET /api/test/staging-suppliers` - простой тест данных

## Структура API

### Основные эндпоинты (требуют аутентификации):

1. **GET** `/api/admin/staging-suppliers` - Получение списка на модерацию
2. **POST** `/api/admin/approve-supplier` - Одобрение поставщика
3. **POST** `/api/admin/merge-supplier` - Объединение с существующим поставщиком
4. **POST** `/api/admin/reject-supplier` - Отклонение поставщика

### Тестовые эндпоинты (без аутентификации):

1. **GET** `/api/admin-test/staging-suppliers` - Тест получения списка
2. **GET** `/api/test/staging-suppliers` - Простой тест данных

## Примеры использования

### Получение списка на модерацию:
```bash
curl -H "x-admin-token: admin-token-123456" \
  http://localhost:5001/api/admin/staging-suppliers
```

### Одобрение поставщика:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-token: admin-token-123456" \
  -d '{"stagingId": 1}' \
  http://localhost:5001/api/admin/approve-supplier
```

### Отклонение поставщика:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-token: admin-token-123456" \
  -d '{"stagingId": 1}' \
  http://localhost:5001/api/admin/reject-supplier
```

## Проверка работы

1. Убедитесь, что сервер запущен
2. Выполните поиск поставщиков, чтобы создать данные в `staging_suppliers`
3. Используйте один из методов аутентификации выше
4. Протестируйте эндпоинты

## Логирование

Все операции логируются в консоль сервера с префиксами:
- `[AdminModeration]` - основные операции
- `[AdminModerationTest]` - тестовые операции
- `[Test]` - простые тесты
