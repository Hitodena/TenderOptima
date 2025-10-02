# 🏗️ Архитектура системы SupplierFinder

## 📋 Обзор

SupplierFinder построен на современной микросервисной архитектуре с использованием React, Express.js, PostgreSQL и AI-интеграций.

## 🎯 Принципы архитектуры

### 1. Модульность
- **Разделение ответственности**: Каждый модуль отвечает за свою область
- **Слабая связанность**: Минимальные зависимости между модулями
- **Высокая сплоченность**: Логически связанные компоненты вместе

### 2. Масштабируемость
- **Горизонтальное масштабирование**: Добавление новых экземпляров
- **Вертикальное масштабирование**: Увеличение ресурсов
- **Кэширование**: Оптимизация производительности
- **Асинхронность**: Неблокирующие операции

### 3. Надежность
- **Отказоустойчивость**: Система продолжает работать при сбоях
- **Восстановление**: Автоматическое восстановление после ошибок
- **Мониторинг**: Постоянное наблюдение за состоянием
- **Резервирование**: Дублирование критических компонентов

## 🏛️ Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                       │
├─────────────────────────────────────────────────────────────┤
│  React App  │  Vite  │  TypeScript  │  Tailwind CSS       │
├─────────────────────────────────────────────────────────────┤
│                        API Gateway                          │
├─────────────────────────────────────────────────────────────┤
│  Express.js  │  Socket.IO  │  Passport.js  │  Helmet      │
├─────────────────────────────────────────────────────────────┤
│                      Business Logic                         │
├─────────────────────────────────────────────────────────────┤
│  Search Engine  │  AI Analyzer  │  Email Service  │  Auth  │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                             │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL  │  Redis  │  File Storage  │  Vector DB      │
├─────────────────────────────────────────────────────────────┤
│                    External Services                        │
├─────────────────────────────────────────────────────────────┤
│  OpenAI  │  Yandex API  │  Google API  │  Email SMTP    │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Frontend Architecture

### 1. Структура компонентов
```
src/
├── components/          # Переиспользуемые компоненты
│   ├── ui/             # Базовые UI компоненты
│   ├── forms/          # Формы
│   ├── layout/         # Компоненты макета
│   └── business/       # Бизнес-компоненты
├── pages/              # Страницы приложения
├── hooks/              # Пользовательские хуки
├── services/           # API сервисы
├── utils/              # Утилиты
├── types/              # TypeScript типы
└── constants/          # Константы
```

### 2. Управление состоянием
- **React Context**: Глобальное состояние
- **Local State**: Локальное состояние компонентов
- **Server State**: Состояние сервера (TanStack Query)
- **Form State**: Состояние форм (React Hook Form)

### 3. Роутинг
- **Wouter**: Легковесный роутер
- **Protected Routes**: Защищенные маршруты
- **Lazy Loading**: Ленивая загрузка компонентов
- **Code Splitting**: Разделение кода

## 🚀 Backend Architecture

### 1. Структура сервера
```
server/
├── routes/             # API маршруты
├── middleware/         # Промежуточное ПО
├── services/           # Бизнес-логика
├── models/            # Модели данных
├── utils/             # Утилиты
├── monitoring/        # Мониторинг
└── config/           # Конфигурация
```

### 2. API Design
- **RESTful API**: Стандартные HTTP методы
- **GraphQL**: Для сложных запросов (планируется)
- **WebSocket**: Реальное время
- **Rate Limiting**: Ограничение запросов
- **CORS**: Настройка CORS

### 3. Middleware Stack
```javascript
app.use(helmet())           // Безопасность
app.use(cors())            // CORS
app.use(compression())     // Сжатие
app.use(rateLimit())       // Ограничение запросов
app.use(csrf())            // CSRF защита
app.use(session())         // Сессии
app.use(passport())        // Аутентификация
app.use(logger())          // Логирование
```

## 🗄️ Database Architecture

### 1. PostgreSQL Schema
```sql
-- Пользователи
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Запросы на поиск
CREATE TABLE search_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  requirements JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Поставщики
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  website VARCHAR(255),
  contact_info JSONB,
  rating DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Результаты поиска
CREATE TABLE search_results (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES search_requests(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  relevance_score DECIMAL(5,4),
  source VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Индексы
```sql
-- Индексы для оптимизации
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_requests_user_id ON search_requests(user_id);
CREATE INDEX idx_requests_status ON search_requests(status);
CREATE INDEX idx_suppliers_rating ON suppliers(rating);
CREATE INDEX idx_results_request_id ON search_results(request_id);
CREATE INDEX idx_results_supplier_id ON search_results(supplier_id);
```

### 3. Миграции
- **Drizzle ORM**: Типобезопасные миграции
- **Версионирование**: Отслеживание изменений схемы
- **Откат**: Возможность отката миграций
- **Автоматизация**: Автоматическое применение миграций

## 🤖 AI Integration Architecture

### 1. OpenAI Integration
```typescript
// Сервис для работы с OpenAI
class OpenAIService {
  async analyzeText(text: string, type: 'requirements' | 'supplier'): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(text, type);
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    });
    return this.parseResponse(response);
  }
}
```

### 2. Векторизация
```typescript
// Сервис векторизации
class VectorizationService {
  async vectorizeText(text: string): Promise<number[]> {
    const embedding = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return embedding.data[0].embedding;
  }
}
```

### 3. Семантический поиск
```typescript
// Семантический поиск
class SemanticSearchService {
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const queryVector = await this.vectorizeText(query);
    const results = await this.vectorDB.search(queryVector, limit);
    return this.rankResults(results);
  }
}
```

## 📧 Email Service Architecture

### 1. IMAP Integration
```typescript
// Сервис для работы с IMAP
class IMAPService {
  async connect(): Promise<void> {
    this.connection = await imap.connect({
      host: process.env.IMAP_HOST,
      port: process.env.IMAP_PORT,
      tls: true,
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASS
    });
  }

  async fetchEmails(): Promise<Email[]> {
    // Получение и обработка писем
  }
}
```

### 2. SMTP Integration
```typescript
// Сервис для отправки писем
class SMTPService {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html: body
    });
  }
}
```

## 🔍 Search Engine Architecture

### 1. Универсальный поиск
```typescript
// Универсальный поисковый движок
class UniversalSearchEngine {
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const results = await Promise.all([
      this.yandexSearch(query),
      this.googleSearch(query),
      this.internalSearch(query)
    ]);
    return this.mergeAndRankResults(results);
  }
}
```

### 2. Yandex Search
```typescript
// Интеграция с Yandex
class YandexSearchService {
  async search(query: string, region: string = 'ru'): Promise<SearchResult[]> {
    const response = await this.api.search({
      query,
      region,
      count: 10
    });
    return this.parseResults(response);
  }
}
```

### 3. Google Search
```typescript
// Интеграция с Google
class GoogleSearchService {
  async search(query: string, region: string = 'us'): Promise<SearchResult[]> {
    const response = await this.api.search({
      q: query,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      key: process.env.GOOGLE_API_KEY
    });
    return this.parseResults(response);
  }
}
```

## 📊 Monitoring Architecture

### 1. Health Monitoring
```typescript
// Мониторинг здоровья системы
class HealthMonitor {
  async getHealthStatus(): Promise<HealthStatus> {
    return {
      status: await this.checkSystemStatus(),
      database: await this.checkDatabase(),
      memory: this.getMemoryUsage(),
      cpu: this.getCPUUsage(),
      requests: this.getRequestMetrics()
    };
  }
}
```

### 2. Logging System
```typescript
// Система логирования
class Logger {
  log(level: LogLevel, message: string, context?: any): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };
    this.writeToFile(entry);
    this.sendToExternalService(entry);
  }
}
```

### 3. Metrics Collection
```typescript
// Сбор метрик
class MetricsCollector {
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric = {
      name,
      value,
      labels,
      timestamp: Date.now()
    };
    this.storeMetric(metric);
  }
}
```

## 🔒 Security Architecture

### 1. Authentication
```typescript
// Аутентификация
class AuthService {
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.validateCredentials(email, password);
    const token = this.generateToken(user);
    return { user, token };
  }
}
```

### 2. Authorization
```typescript
// Авторизация
class AuthorizationService {
  async checkPermission(user: User, resource: string, action: string): Promise<boolean> {
    const role = await this.getUserRole(user.id);
    return this.roleHasPermission(role, resource, action);
  }
}
```

### 3. Data Protection
```typescript
// Защита данных
class DataProtectionService {
  encrypt(data: any): string {
    return crypto.encrypt(JSON.stringify(data));
  }

  decrypt(encryptedData: string): any {
    return JSON.parse(crypto.decrypt(encryptedData));
  }
}
```

## 🚀 Deployment Architecture

### 1. Containerization
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

### 2. Load Balancing
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=supplierfinder
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### 3. CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker build -t supplierfinder .
      - run: docker push registry/supplierfinder
```

## 📈 Performance Architecture

### 1. Caching Strategy
```typescript
// Стратегия кэширования
class CacheService {
  async get(key: string): Promise<any> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

### 2. Database Optimization
```sql
-- Оптимизация запросов
EXPLAIN ANALYZE SELECT * FROM search_results 
WHERE request_id = $1 
ORDER BY relevance_score DESC 
LIMIT 10;

-- Партиционирование
CREATE TABLE search_results_2024 PARTITION OF search_results
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### 3. Async Processing
```typescript
// Асинхронная обработка
class AsyncProcessor {
  async processSearchRequest(request: SearchRequest): Promise<void> {
    await this.queue.add('search-request', {
      requestId: request.id,
      query: request.query,
      priority: request.priority
    });
  }
}
```

## 🔄 Scalability Architecture

### 1. Horizontal Scaling
- **Load Balancer**: Распределение нагрузки
- **Multiple Instances**: Несколько экземпляров приложения
- **Database Sharding**: Разделение данных по шардам
- **CDN**: Распределение статических ресурсов

### 2. Vertical Scaling
- **CPU**: Увеличение вычислительной мощности
- **Memory**: Увеличение объема памяти
- **Storage**: Увеличение объема хранилища
- **Network**: Увеличение пропускной способности

### 3. Microservices (Future)
- **Search Service**: Отдельный сервис поиска
- **AI Service**: Отдельный сервис AI
- **Email Service**: Отдельный сервис email
- **User Service**: Отдельный сервис пользователей

---

**Архитектура системы** 🏗️ обеспечивает высокую производительность, надежность и масштабируемость SupplierFinder.


