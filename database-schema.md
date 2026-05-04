# 📊 База данных SupplierFinder - Полная схема

## Обзор архитектуры

**Основной поток данных:**

```
Пользователь → searchRequests → Парсер → stagingSuppliers → Email рассылка → supplierResponses → AI анализ
```

**Технологии:**

- PostgreSQL
- Drizzle ORM (TypeScript)
- Row Level Security
- JSON поля для гибкости

---

## 🧑‍💼 1. Пользователи и аутентификация

### users

**Назначение:** Основные пользователи системы
**Наследование:** Base table

| Поле | Тип | Описание | Обязательно | Индекс | По умолчанию |
|------|-----|----------|-------------|---------|--------------|
| `id` | SERIAL | Первичный ключ | ✅ | PK | auto |
| `username` | VARCHAR(255) | Уникальный логин | ✅ | unique | - |
| `password` | VARCHAR(255) | Хэшированный пароль (bcrypt) | ✅ | - | - |
| `email` | VARCHAR(255) | Email для уведомлений | ❌ | - | - |
| `role` | VARCHAR(50) | Роль (user/admin) | ✅ | - | 'user' |
| `subscription_id` | INTEGER | FK → subscriptions.id | ❌ | FK | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - | now() |
| `last_login` | TIMESTAMP | Последний вход | ❌ | - | - |

**Ограничения:**

- UNIQUE(username)
- FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL

---

### subscriptions

**Назначение:** Подписки пользователей

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `user_id` | INTEGER | FK → users.id | ✅ | FK |
| `plan_type` | VARCHAR(100) | Тип плана (free/pro/enterprise) | ✅ | - |
| `status` | VARCHAR(50) | active/cancelled/expired | ✅ | index |
| `start_date` | TIMESTAMP | Начало подписки | ✅ | - |
| `end_date` | TIMESTAMP | Окончание подписки | ❌ | - |
| `auto_renew` | BOOLEAN | Автопродление | ✅ | - |
| `price` | DECIMAL(10,2) | Стоимость | ✅ | - |
| `currency` | VARCHAR(3) | Валюта (RUB/USD/EUR) | ✅ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |
| `updated_at` | TIMESTAMP | Дата обновления | ❌ | - |

**Ограничения:**

- FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE

---

### subscription_payments

**Назначение:** Платежи по подпискам (банки, Stripe, другие системы)

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `subscription_id` | INTEGER | FK → subscriptions.id | ✅ | FK |
| `user_id` | INTEGER | FK → users.id | ✅ | FK |
| `invoice_id` | VARCHAR(255) | ID счета/инвойса | ✅ | unique |
| `payment_system` | VARCHAR(50) | stripe/bank/yookassa/etc | ✅ | index |
| `amount` | DECIMAL(10,2) | Сумма платежа | ✅ | - |
| `currency` | VARCHAR(3) | Валюта | ✅ | - |
| `status` | VARCHAR(50) | pending/successed/failed/refunded | ✅ | index |
| `payment_date` | TIMESTAMP | Дата платежа | ✅ | index |
| `external_id` | VARCHAR(255) | ID в платежной системе | ❌ | - |
| `metadata` | JSON | Дополнительные данные | ❌ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |

**Ограничения:**

- FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
- FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
- UNIQUE(invoice_id)

---

## 🏢 2. Каталог поставщиков

### suppliers

**Назначение:** Каталог поставщиков (объединены staging и approved)

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `name` | VARCHAR(500) | Название компании | ✅ | - |
| `email` | VARCHAR(255) | Основной email | ✅ | unique |
| `phone` | VARCHAR(50) | Телефон | ❌ | - |
| `website` | VARCHAR(500) | Сайт | ❌ | - |
| `contact_name` | VARCHAR(255) | Контактное лицо | ❌ | - |
| `source` | VARCHAR(50) | yandex/google/manual/parser | ✅ | index |
| `search_query` | VARCHAR(1000) | Запрос, по которому найден | ❌ | - |
| `found_at` | TIMESTAMP | Дата нахождения парсером | ❌ | - |
| `raw_data` | JSON | Исходные данные парсера | ❌ | - |
| `is_approved` | BOOLEAN | Одобрен модератором | ✅ | index |
| `moderation_status` | VARCHAR(50) | pending/approved/rejected | ✅ | index |
| `moderation_notes` | TEXT | Комментарии модератора | ❌ | - |
| `priority_score` | DECIMAL(3,2) | Рейтинг релевантности (0-1) | ✅ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |
| `updated_at` | TIMESTAMP | Дата обновления | ✅ | - |

**Ограничения:**

- UNIQUE(email)

---

### excludedDomains

**Назначение:** Черный список доменов

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `domain` | VARCHAR(255) | Домен (example.com) | ✅ | unique |
| `reason` | TEXT | Причина блокировки | ✅ | - |
| `created_by` | INTEGER | FK → users.id | ✅ | FK |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |

**Ограничения:**

- FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
- UNIQUE(domain)

---

## 📋 3. Запросы на поиск

### searchRequests

**Назначение:** Запросы пользователей на поиск товаров/услуг

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `user_id` | INTEGER | FK → users.id | ✅ | FK |
| `order_number` | VARCHAR(50) | Уникальный REQ-xxxxx | ✅ | unique |
| `product_details` | JSON | Детали товара | ✅ | - |
| `status` | VARCHAR(50) | active/completed/cancelled/draft | ✅ | index |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |
| `updated_at` | TIMESTAMP | Дата обновления | ✅ | - |
| `deadline` | TIMESTAMP | Срок выполнения | ❌ | - |
| `budget` | DECIMAL(12,2) | Бюджет | ❌ | - |
| `quantity` | INTEGER | Количество | ❌ | - |
| `category` | VARCHAR(100) | Категория товара | ❌ | index |
| `priority` | VARCHAR(20) | high/medium/low | ✅ | - |

**JSON структура product_details:**

```json
{
  "name": "Картриджи HP LaserJet",
  "description": "Оригинальные картриджи для принтеров HP",
  "specifications": ["CF280A", "CF281A"],
  "requirements": ["Оригинал", "С доставкой"],
  "region": "Москва"
}
```

---

### requestParameters

**Назначение:** Структурированные параметры запроса

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `request_id` | INTEGER | FK → searchRequests.id | ✅ | FK |
| `parameters` | JSON | JSON с параметрами | ✅ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |
| `updated_at` | TIMESTAMP | Дата обновления | ✅ | - |

---

### requestSuppliers

**Назначение:** Связи запросов с поставщиками (многие-ко-многим)

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `request_id` | INTEGER | FK → searchRequests.id | ✅ | FK |
| `supplier_id` | INTEGER | FK → suppliers.id | ✅ | FK |
| `contacted_at` | TIMESTAMP | Когда отправлен первый email | ❌ | - |
| `last_contacted_at` | TIMESTAMP | Последний контакт | ❌ | - |
| `status` | VARCHAR(50) | contacted/replied/not_interested/blacklisted | ✅ | index |
| `priority` | INTEGER | Приоритет (1-5) | ✅ | - |
| `notes` | TEXT | Заметки пользователя | ❌ | - |
| `created_at` | TIMESTAMP | Дата создания связи | ✅ | - |

**Ограничения:**

- UNIQUE(request_id, supplier_id)

---

---

## 📧 4. Email коммуникации

### supplierResponses

**Назначение:** Ответы поставщиков на email запросы

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `request_id` | INTEGER | FK → searchRequests.id | ✅ | FK |
| `user_id` | INTEGER | FK → users.id | ✅ | FK |
| `supplier_id` | INTEGER | FK → suppliers.id | ❌ | FK |
| `supplier_email` | VARCHAR(255) | Email отправителя | ✅ | index |
| `supplier_name` | VARCHAR(255) | Имя поставщика | ❌ | - |
| `subject` | VARCHAR(500) | Тема письма | ✅ | - |
| `content` | TEXT | Текст письма | ✅ | - |
| `attachments` | JSON | Массив вложений | ❌ | - |
| `response_date` | TIMESTAMP | Дата получения | ✅ | index |
| `is_read` | BOOLEAN | Прочитано пользователем | ✅ | index |
| `processing_status` | VARCHAR(50) | pending/processing/completed/failed | ✅ | index |
| `processing_error` | TEXT | Ошибка обработки | ❌ | - |
| `is_analyzed` | BOOLEAN | Проанализировано AI | ✅ | index |
| `request_supplier_id` | INTEGER | FK → requestSuppliers.id | ❌ | FK |
| `is_replied_to` | BOOLEAN | Пользователь ответил | ✅ | - |
| `is_favorite` | BOOLEAN | В избранном | ✅ | - |
| `created_at` | TIMESTAMP | Дата создания записи | ✅ | - |

**JSON структура attachments:**

```json
[
  {
    "filename": "price_list.pdf",
    "contentType": "application/pdf",
    "content": "base64_encoded_content",
    "size": 1024000,
    "extractedText": "Текст, извлеченный из PDF...",
    "processedAt": "2024-01-01T10:00:00Z",
    "processingStatus": {
      "status": "success",
      "method": "OCR"
    }
  }
]
```

---

### emailRequests

**Назначение:** История отправленных email

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `user_id` | INTEGER | FK → users.id | ✅ | FK |
| `request_id` | INTEGER | FK → searchRequests.id | ✅ | FK |
| `supplier_email` | VARCHAR(255) | Email получателя | ✅ | - |
| `subject` | VARCHAR(500) | Тема письма | ✅ | - |
| `content` | TEXT | Содержимое | ✅ | - |
| `sent_at` | TIMESTAMP | Дата отправки | ✅ | - |
| `status` | VARCHAR(50) | sent/delivered/opened/failed | ✅ | index |
| `opened_at` | TIMESTAMP | Дата открытия | ❌ | - |

---

### contactItems

**Назначение:** Контактные данные поставщиков

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `supplier_id` | INTEGER | FK → suppliers.id | ❌ | FK |
| `name` | VARCHAR(255) | Имя контакта | ✅ | - |
| `email` | VARCHAR(255) | Email | ✅ | index |
| `phone` | VARCHAR(50) | Телефон | ❌ | - |
| `position` | VARCHAR(255) | Должность | ❌ | - |
| `notes` | TEXT | Заметки | ❌ | - |
| `last_contacted` | TIMESTAMP | Последний контакт | ❌ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |

---

## 🤖 5. ИИ анализ и обработка

### extractedParameters

**Назначение:** Параметры, извлеченные AI из email

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `response_id` | INTEGER | FK → supplierResponses.id | ✅ | FK |
| `parameter_name` | VARCHAR(255) | Название (цена, срок, условия) | ✅ | index |
| `value` | TEXT | Извлеченное значение | ✅ | - |
| `confidence` | DECIMAL(3,2) | Уверенность AI (0-1) | ✅ | - |
| `source` | VARCHAR(50) | content/attachment/filename | ✅ | index |
| `model_version` | VARCHAR(50) | Версия AI модели | ❌ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |
| `updated_at` | TIMESTAMP | Дата обновления | ✅ | - |

---

### analysisResults

**Назначение:** Результаты комплексного анализа

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `request_id` | INTEGER | FK → searchRequests.id | ✅ | FK |
| `analysis_type` | VARCHAR(100) | comparison/technical/compliance | ✅ | index |
| `result_data` | JSON | Структурированные результаты | ✅ | - |
| `summary` | TEXT | Краткое резюме | ❌ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |
| `model_used` | VARCHAR(100) | AI модель | ❌ | - |
| `confidence` | DECIMAL(3,2) | Общая уверенность | ❌ | - |
| `processing_time` | INTEGER | Время обработки (сек) | ❌ | - |

---

### improvementRequests

**Назначение:** Запросы пользователей на улучшения системы

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `user_id` | INTEGER | FK → users.id | ✅ | FK |
| `request_type` | VARCHAR(50) | bug/feature/improvement | ✅ | index |
| `title` | VARCHAR(500) | Заголовок | ✅ | - |
| `description` | TEXT | Подробное описание | ✅ | - |
| `status` | VARCHAR(50) | pending/in_progress/completed/rejected | ✅ | index |
| `priority` | VARCHAR(20) | low/medium/high/critical | ✅ | - |
| `assigned_to` | INTEGER | FK → users.id (админ) | ❌ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |
| `updated_at` | TIMESTAMP | Дата обновления | ✅ | - |

---

### winnerSelections

**Назначение:** Выбор победителей тендеров

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `request_id` | INTEGER | FK → searchRequests.id | ✅ | FK |
| `supplier_id` | INTEGER | FK → suppliers.id | ✅ | FK |
| `reason` | TEXT | Причина выбора | ✅ | - |
| `selection_criteria` | JSON | Критерии выбора | ❌ | - |
| `selected_at` | TIMESTAMP | Дата выбора | ✅ | - |
| `selected_by` | INTEGER | FK → users.id | ✅ | FK |

---

## 👥 6. Контакты

### contactItems

**Назначение:** Контактные данные поставщиков

| Поле | Тип | Описание | Обязательно | Индекс |
|------|-----|----------|-------------|---------|
| `id` | SERIAL | PK | ✅ | PK |
| `supplier_id` | INTEGER | FK → suppliers.id | ❌ | FK |
| `name` | VARCHAR(255) | Имя контакта | ✅ | - |
| `email` | VARCHAR(255) | Email | ✅ | index |
| `phone` | VARCHAR(50) | Телефон | ❌ | - |
| `position` | VARCHAR(255) | Должность | ❌ | - |
| `notes` | TEXT | Заметки | ❌ | - |
| `last_contacted` | TIMESTAMP | Последний контакт | ❌ | - |
| `created_at` | TIMESTAMP | Дата создания | ✅ | - |

---
