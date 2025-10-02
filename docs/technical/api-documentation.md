# 🔌 API Документация SupplierFinder

## 📋 Обзор

SupplierFinder предоставляет RESTful API для интеграции с внешними системами и управления данными.

## 🔗 Базовый URL

```
Production: https://api.supplierfinder.com
Development: http://localhost:5000
```

## 🔐 Аутентификация

### Bearer Token
```http
Authorization: Bearer <your-token>
```

### Session Cookie
```http
Cookie: session=<session-id>
```

## 📊 Статус коды

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 201 | Создано |
| 400 | Неверный запрос |
| 401 | Не авторизован |
| 403 | Доступ запрещен |
| 404 | Не найдено |
| 429 | Превышен лимит запросов |
| 500 | Внутренняя ошибка сервера |

## 🏥 Health & Status

### GET /api/health
Проверка здоровья системы

**Ответ:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400000,
  "version": "1.0.0",
  "environment": "production",
  "database": {
    "status": "connected",
    "responseTime": 15
  },
  "memory": {
    "used": 524288000,
    "total": 1073741824,
    "percentage": 48.8
  },
  "cpu": {
    "usage": 25.5,
    "load": 1.2
  }
}
```

### GET /api/status
Детальный статус системы

**Ответ:**
```json
{
  "status": "operational",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "openai": "connected",
    "yandex": "connected",
    "google": "connected"
  },
  "metrics": {
    "requests": {
      "total": 15420,
      "successful": 15380,
      "failed": 40,
      "rate": 2.5
    },
    "responseTime": {
      "average": 150,
      "p95": 300,
      "p99": 500
    }
  }
}
```

## 👤 Аутентификация

### POST /api/auth/register
Регистрация нового пользователя

**Тело запроса:**
```json
{
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```

**Ответ:**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "name": "Иван Иванов",
    "email": "ivan@example.com",
    "role": "user",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Пользователь успешно зарегистрирован"
}
```

### POST /api/auth/login
Вход в систему

**Тело запроса:**
```json
{
  "email": "ivan@example.com",
  "password": "SecurePassword123!"
}
```

**Ответ:**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "name": "Иван Иванов",
    "email": "ivan@example.com",
    "role": "user"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Успешный вход в систему"
}
```

### POST /api/auth/logout
Выход из системы

**Ответ:**
```json
{
  "success": true,
  "message": "Успешный выход из системы"
}
```

### GET /api/auth/me
Получение информации о текущем пользователе

**Ответ:**
```json
{
  "id": 123,
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "role": "user",
  "businessCard": "Описание деятельности",
  "language": "ru",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## 📝 Запросы на поиск

### GET /api/requests
Получение списка запросов

**Параметры:**
- `page` (query): Номер страницы (по умолчанию: 1)
- `limit` (query): Количество записей на странице (по умолчанию: 20)
- `status` (query): Фильтр по статусу
- `sort` (query): Сортировка (created_at, updated_at, title)

**Ответ:**
```json
{
  "requests": [
    {
      "id": 1,
      "title": "Поиск поставщиков электроники",
      "description": "Требуется найти поставщиков электронных компонентов",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### POST /api/requests
Создание нового запроса

**Тело запроса:**
```json
{
  "title": "Поиск поставщиков электроники",
  "description": "Требуется найти поставщиков электронных компонентов",
  "requirements": [
    "ISO 9001 сертификация",
    "Доставка по России",
    "Минимальный заказ 1000 штук"
  ],
  "budget": 100000,
  "deadline": "2024-02-15"
}
```

**Ответ:**
```json
{
  "success": true,
  "request": {
    "id": 1,
    "title": "Поиск поставщиков электроники",
    "description": "Требуется найти поставщиков электронных компонентов",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /api/requests/:id
Получение конкретного запроса

**Ответ:**
```json
{
  "id": 1,
  "title": "Поиск поставщиков электроники",
  "description": "Требуется найти поставщиков электронных компонентов",
  "requirements": [
    "ISO 9001 сертификация",
    "Доставка по России",
    "Минимальный заказ 1000 штук"
  ],
  "status": "completed",
  "results": [
    {
      "id": 1,
      "supplier": {
        "id": 1,
        "name": "ООО Электроника",
        "website": "https://electronics.ru",
        "rating": 4.5
      },
      "relevanceScore": 0.95,
      "source": "yandex"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

## 🔍 Поиск поставщиков

### POST /api/supplier-search
Поиск поставщиков

**Тело запроса:**
```json
{
  "query": "поставщики электроники",
  "maxResults": 20,
  "regions": ["ru", "by", "kz"],
  "filters": {
    "rating": 4.0,
    "certifications": ["ISO 9001"]
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "name": "ООО Электроника",
      "description": "Производитель электронных компонентов",
      "website": "https://electronics.ru",
      "contact": {
        "email": "info@electronics.ru",
        "phone": "+7 (495) 123-45-67"
      },
      "rating": 4.5,
      "relevanceScore": 0.95,
      "source": "yandex",
      "location": "Москва, Россия"
    }
  ],
  "total": 1,
  "query": "поставщики электроники",
  "executionTime": 1250
}
```

### POST /api/universal-search
Универсальный поиск

**Тело запроса:**
```json
{
  "query": "поставщики электроники",
  "sources": ["yandex", "google", "internal"],
  "maxResults": 30,
  "regions": ["ru"]
}
```

**Ответ:**
```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "name": "ООО Электроника",
      "description": "Производитель электронных компонентов",
      "website": "https://electronics.ru",
      "rating": 4.5,
      "relevanceScore": 0.95,
      "source": "yandex"
    }
  ],
  "sources": {
    "yandex": 15,
    "google": 12,
    "internal": 3
  },
  "total": 30,
  "executionTime": 2100
}
```

## 🤖 AI Анализ

### POST /api/analyze
Анализ текста с помощью AI

**Тело запроса:**
```json
{
  "text": "Требуется найти поставщиков электронных компонентов с ISO 9001 сертификацией",
  "type": "requirements",
  "options": {
    "extractKeywords": true,
    "categorize": true,
    "suggestImprovements": true
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "analysis": {
    "keywords": [
      "поставщики",
      "электронные компоненты",
      "ISO 9001",
      "сертификация"
    ],
    "categories": [
      "электроника",
      "сертификация",
      "поставщики"
    ],
    "suggestions": [
      "Добавить требования к минимальному заказу",
      "Указать географический регион",
      "Добавить требования к срокам доставки"
    ],
    "confidence": 0.92
  }
}
```

### POST /api/extract-parameters
Извлечение параметров из текста

**Тело запроса:**
```json
{
  "text": "Требуется поставщик с ISO 9001, доставка по России, минимальный заказ 1000 штук",
  "parameters": ["certification", "delivery", "minOrder"],
  "useAI": true
}
```

**Ответ:**
```json
{
  "success": true,
  "extractedParameters": {
    "certification": "ISO 9001",
    "delivery": "Россия",
    "minOrder": "1000 штук"
  },
  "confidence": 0.88
}
```

## 👤 Управление пользователями

### GET /api/user/profile
Получение профиля пользователя

**Ответ:**
```json
{
  "id": 123,
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "businessCard": "Описание деятельности",
  "language": "ru",
  "notifications": {
    "email": true,
    "push": false,
    "sms": false
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### PUT /api/user/profile
Обновление профиля пользователя

**Тело запроса:**
```json
{
  "name": "Иван Петров",
  "businessCard": "Новое описание деятельности",
  "language": "en"
}
```

**Ответ:**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "name": "Иван Петров",
    "email": "ivan@example.com",
    "businessCard": "Новое описание деятельности",
    "language": "en"
  }
}
```

### PUT /api/user/email-config
Настройка email интеграции

**Тело запроса:**
```json
{
  "emailAccount": "ivan@example.com",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "ivan@example.com",
  "smtpPass": "app-password",
  "imapHost": "imap.gmail.com",
  "imapPort": 993
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Email настройки сохранены"
}
```

## 📊 Аналитика

### GET /api/analytics/overview
Общая аналитика

**Ответ:**
```json
{
  "requests": {
    "total": 150,
    "completed": 120,
    "pending": 20,
    "failed": 10
  },
  "suppliers": {
    "total": 500,
    "active": 450,
    "new": 50
  },
  "searches": {
    "total": 300,
    "successful": 280,
    "failed": 20
  },
  "performance": {
    "averageResponseTime": 150,
    "successRate": 93.3
  }
}
```

### GET /api/analytics/requests
Аналитика по запросам

**Параметры:**
- `period` (query): Период (day, week, month, year)
- `startDate` (query): Начальная дата
- `endDate` (query): Конечная дата

**Ответ:**
```json
{
  "period": "month",
  "requests": [
    {
      "date": "2024-01-01",
      "count": 15,
      "completed": 12,
      "pending": 3
    }
  ],
  "total": 150,
  "trend": "increasing"
}
```

## 🔧 Администрирование

### GET /api/admin/users
Управление пользователями (только для админов)

**Ответ:**
```json
{
  "users": [
    {
      "id": 123,
      "name": "Иван Иванов",
      "email": "ivan@example.com",
      "role": "user",
      "status": "active",
      "lastLogin": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "pagination": {
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### PUT /api/admin/users/:id/role
Изменение роли пользователя

**Тело запроса:**
```json
{
  "role": "moderator"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Роль пользователя изменена"
}
```

## 📈 Мониторинг

### GET /api/metrics
Метрики системы

**Ответ:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400000,
  "performance": {
    "requests": {
      "total": 15420,
      "successful": 15380,
      "failed": 40,
      "rate": 2.5
    },
    "responseTime": {
      "average": 150,
      "p95": 300,
      "p99": 500
    },
    "errors": {
      "total": 40,
      "rate": 0.26
    }
  },
  "system": {
    "memory": {
      "used": 524288000,
      "total": 1073741824,
      "percentage": 48.8
    },
    "cpu": {
      "usage": 25.5,
      "load": 1.2
    }
  }
}
```

### GET /api/metrics/prometheus
Метрики в формате Prometheus

**Ответ:**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 15380
http_requests_total{method="POST",status="200"} 1200

# HELP http_request_duration_ms HTTP request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{le="100"} 1000
http_request_duration_ms_bucket{le="200"} 2000
http_request_duration_ms_bucket{le="500"} 3000
```

## 🚨 Обработка ошибок

### Стандартный формат ошибки
```json
{
  "error": "ValidationError",
  "message": "Неверные данные запроса",
  "details": {
    "field": "email",
    "reason": "Неверный формат email"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Коды ошибок
| Код | Описание | Пример |
|-----|----------|--------|
| VALIDATION_ERROR | Ошибка валидации | Неверный формат email |
| AUTHENTICATION_ERROR | Ошибка аутентификации | Неверный пароль |
| AUTHORIZATION_ERROR | Ошибка авторизации | Недостаточно прав |
| NOT_FOUND_ERROR | Ресурс не найден | Пользователь не найден |
| RATE_LIMIT_ERROR | Превышен лимит | Слишком много запросов |
| INTERNAL_ERROR | Внутренняя ошибка | Ошибка сервера |

## 🔄 Rate Limiting

### Лимиты запросов
- **Аутентификация**: 5 запросов в минуту
- **API**: 100 запросов в минуту
- **Поиск**: 20 запросов в минуту
- **AI анализ**: 10 запросов в минуту

### Заголовки ответа
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

## 📝 Примеры использования

### JavaScript/Node.js
```javascript
const response = await fetch('https://api.supplierfinder.com/api/supplier-search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },
  body: JSON.stringify({
    query: 'поставщики электроники',
    maxResults: 20,
    regions: ['ru']
  })
});

const data = await response.json();
console.log(data.results);
```

### Python
```python
import requests

response = requests.post(
    'https://api.supplierfinder.com/api/supplier-search',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-token'
    },
    json={
        'query': 'поставщики электроники',
        'maxResults': 20,
        'regions': ['ru']
    }
)

data = response.json()
print(data['results'])
```

### cURL
```bash
curl -X POST https://api.supplierfinder.com/api/supplier-search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "query": "поставщики электроники",
    "maxResults": 20,
    "regions": ["ru"]
  }'
```

---

**API документация** 🔌 предоставляет полную информацию для интеграции с SupplierFinder.


