# API Модерации Поставщиков

## Обзор
API для управления данными в "песочнице" (staging_suppliers) - интерфейс модерации для админ-панели.

## Базовый URL
```
http://localhost:5001/api/admin
```

## Эндпоинты

### 1. Получение списка на модерацию
**GET** `/staging-suppliers`

Возвращает все записи из `staging_suppliers` со статусом `'new'` с дополнительной информацией о дубликатах.

#### Ответ:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sourceEngine": "google",
      "searchQuery": "шины купить",
      "region": "ru",
      "rawTitle": "Шины-онлайн",
      "rawDescription": "Продажа шин",
      "rawUrl": "https://shiny-online.ru",
      "rawEmails": ["info@shiny-online.ru"],
      "rawPhones": ["+7-800-123-45-67"],
      "status": "new",
      "createdAt": "2024-01-15T10:30:00Z",
      "isDuplicate": false,
      "matchedSupplierId": null,
      "domain": "shiny-online.ru"
    }
  ],
  "total": 1
}
```

### 2. Одобрение поставщика
**POST** `/approve-supplier`

Создает новую запись в таблице `suppliers` и связывает с ключевыми словами.

#### Тело запроса:
```json
{
  "stagingId": 1
}
```

#### Ответ:
```json
{
  "success": true,
  "message": "Supplier approved successfully",
  "data": {
    "stagingId": 1,
    "newSupplierId": 15,
    "supplierName": "Шины-онлайн",
    "website": "https://shiny-online.ru"
  }
}
```

### 3. Обработка дубликата
**POST** `/merge-supplier`

Связывает существующего поставщика с новым ключевым словом.

#### Тело запроса:
```json
{
  "stagingId": 1,
  "existingSupplierId": 10
}
```

#### Ответ:
```json
{
  "success": true,
  "message": "Supplier merged successfully",
  "data": {
    "stagingId": 1,
    "existingSupplierId": 10,
    "supplierName": "Существующий поставщик",
    "website": "https://existing-supplier.ru",
    "newKeyword": "шины купить"
  }
}
```

### 4. Отклонение поставщика
**POST** `/reject-supplier`

Изменяет статус записи на `'rejected'`.

#### Тело запроса:
```json
{
  "stagingId": 1
}
```

#### Ответ:
```json
{
  "success": true,
  "message": "Supplier rejected successfully",
  "data": {
    "stagingId": 1,
    "supplierName": "Шины-онлайн",
    "website": "https://shiny-online.ru"
  }
}
```

## Статусы записей

- `'new'` - новая запись, ожидает модерации
- `'approved'` - одобрена, создана запись в suppliers
- `'merged'` - объединена с существующим поставщиком
- `'rejected'` - отклонена

## Обработка ошибок

Все эндпоинты возвращают ошибки в формате:
```json
{
  "success": false,
  "error": "Описание ошибки",
  "details": "Детали ошибки"
}
```

## Тестирование

Для тестирования API используйте:
```bash
node test-moderation-api.js
```

## Логирование

Все операции логируются в консоль сервера с префиксом `[AdminModeration]`.
