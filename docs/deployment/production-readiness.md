# 🚀 Подготовка к продакшну SupplierFinder

## 📋 Обзор

Этот документ описывает процесс подготовки SupplierFinder к развертыванию в продакшн среде.

## ✅ Чеклист готовности

### 🔧 Техническая готовность
- [ ] Все тесты пройдены (100% покрытие)
- [ ] Производительность соответствует требованиям
- [ ] Безопасность настроена и протестирована
- [ ] Мониторинг и логирование настроены
- [ ] Документация обновлена
- [ ] CI/CD пайплайн настроен

### 🗄️ База данных
- [ ] Миграции применены
- [ ] Индексы созданы
- [ ] Резервное копирование настроено
- [ ] Мониторинг БД настроен
- [ ] Оптимизация запросов выполнена

### 🔒 Безопасность
- [ ] HTTPS настроен
- [ ] Сертификаты SSL установлены
- [ ] Firewall настроен
- [ ] Аутентификация настроена
- [ ] Авторизация настроена
- [ ] CSRF защита включена
- [ ] XSS защита включена

### 📊 Мониторинг
- [ ] Health checks настроены
- [ ] Метрики собираются
- [ ] Алерты настроены
- [ ] Логирование настроено
- [ ] Дашборд доступен

## 🏗️ Инфраструктура

### Минимальные требования
- **CPU**: 4 ядра
- **RAM**: 8GB
- **Диск**: 100GB SSD
- **Сеть**: 1Gbps
- **OS**: Ubuntu 20.04+ или эквивалент

### Рекомендуемые требования
- **CPU**: 8 ядер
- **RAM**: 16GB
- **Диск**: 500GB SSD
- **Сеть**: 10Gbps
- **OS**: Ubuntu 22.04 LTS

### Архитектура продакшна
```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                        │
├─────────────────────────────────────────────────────────────┤
│  App Server 1  │  App Server 2  │  App Server 3           │
├─────────────────────────────────────────────────────────────┤
│                    Database Cluster                         │
├─────────────────────────────────────────────────────────────┤
│  Primary DB   │  Replica DB   │  Backup DB                │
├─────────────────────────────────────────────────────────────┤
│                    Cache Layer                              │
├─────────────────────────────────────────────────────────────┤
│  Redis Cluster  │  CDN  │  File Storage                   │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Конфигурация

### Переменные окружения
```bash
# .env.production
NODE_ENV=production
PORT=5000
CLIENT_URL=https://supplierfinder.com

# Database
DATABASE_URL=postgresql://user:password@db-host:5432/supplierfinder
DATABASE_SSL=true
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Security
TOKEN_SECRET=your-super-secure-token-secret-here
SESSION_SECRET=your-super-secure-session-secret-here
CSRF_SECRET=your-super-secure-csrf-secret-here

# External APIs
OPENAI_API_KEY=your-openai-api-key
YANDEX_API_KEY=your-yandex-api-key
YANDEX_SEARCH_ID=your-yandex-search-id
GOOGLE_API_KEY=your-google-api-key
GOOGLE_SEARCH_ENGINE_ID=your-google-search-engine-id

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993

# Monitoring
LOG_LEVEL=info
LOG_DIR=/var/log/supplierfinder
MONITORING_ENABLED=true
METRICS_ENABLED=true
ALERTS_ENABLED=true

# Performance
CACHE_TTL=3600
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Конфигурация базы данных
```sql
-- Настройки PostgreSQL для продакшна
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Перезапуск для применения настроек
SELECT pg_reload_conf();
```

### Конфигурация Redis
```conf
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
tcp-keepalive 300
timeout 0
```

## 🐳 Docker конфигурация

### Dockerfile
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S supplierfinder -u 1001

# Copy built application
COPY --from=builder --chown=supplierfinder:nodejs /app/dist ./dist
COPY --from=builder --chown=supplierfinder:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=supplierfinder:nodejs /app/package*.json ./

# Switch to non-root user
USER supplierfinder

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server/index.js"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/supplierfinder
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=supplierfinder
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## 🌐 Nginx конфигурация

### nginx.conf
```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:5000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    server {
        listen 80;
        server_name supplierfinder.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name supplierfinder.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Login rate limiting
        location /api/auth/login {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location / {
            root /var/www/html;
            try_files $uri $uri/ /index.html;
        }

        # Health check
        location /health {
            access_log off;
            proxy_pass http://app/api/health;
        }
    }
}
```

## 🔒 SSL сертификаты

### Let's Encrypt
```bash
# Установка Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d supplierfinder.com -d www.supplierfinder.com

# Автоматическое обновление
sudo crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Самоподписанный сертификат (для тестирования)
```bash
# Генерация приватного ключа
openssl genrsa -out key.pem 2048

# Генерация сертификата
openssl req -new -x509 -key key.pem -out cert.pem -days 365 \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=SupplierFinder/CN=supplierfinder.com"
```

## 📊 Мониторинг

### Prometheus конфигурация
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'supplierfinder'
    static_configs:
      - targets: ['app:5000']
    metrics_path: '/api/metrics/prometheus'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['db:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

### Grafana дашборд
```json
{
  "dashboard": {
    "title": "SupplierFinder Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

## 🚀 Развертывание

### 1. Подготовка сервера
```bash
# Обновление системы
sudo apt-get update && sudo apt-get upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Клонирование и настройка
```bash
# Клонирование репозитория
git clone https://github.com/your-org/supplierfinder.git
cd supplierfinder

# Настройка переменных окружения
cp env.example .env.production
nano .env.production

# Настройка SSL сертификатов
mkdir ssl
# Поместите сертификаты в папку ssl/
```

### 3. Запуск приложения
```bash
# Сборка и запуск
docker-compose -f docker-compose.prod.yml up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker-compose logs -f app
```

### 4. Проверка работоспособности
```bash
# Проверка health check
curl https://supplierfinder.com/api/health

# Проверка метрик
curl https://supplierfinder.com/api/metrics

# Проверка SSL
openssl s_client -connect supplierfinder.com:443 -servername supplierfinder.com
```

## 🔄 CI/CD пайплайн

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t supplierfinder:${{ github.sha }} .
      - name: Push to registry
        run: docker push registry/supplierfinder:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh user@server "docker pull registry/supplierfinder:${{ github.sha }}"
          ssh user@server "docker-compose up -d"
```

## 🛠️ Обслуживание

### Резервное копирование
```bash
# Создание резервной копии БД
docker exec postgres pg_dump -U postgres supplierfinder > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из резервной копии
docker exec -i postgres psql -U postgres supplierfinder < backup_20240115_120000.sql
```

### Обновление приложения
```bash
# Получение обновлений
git pull origin main

# Пересборка и перезапуск
docker-compose down
docker-compose build
docker-compose up -d

# Проверка работоспособности
curl https://supplierfinder.com/api/health
```

### Мониторинг логов
```bash
# Просмотр логов приложения
docker-compose logs -f app

# Просмотр логов БД
docker-compose logs -f db

# Просмотр логов Nginx
docker-compose logs -f nginx
```

## 🚨 Устранение проблем

### Частые проблемы

#### 1. Ошибки подключения к БД
```bash
# Проверка статуса БД
docker-compose ps db

# Перезапуск БД
docker-compose restart db

# Проверка логов
docker-compose logs db
```

#### 2. Ошибки SSL
```bash
# Проверка сертификатов
openssl x509 -in ssl/cert.pem -text -noout

# Обновление сертификатов
sudo certbot renew
```

#### 3. Проблемы с производительностью
```bash
# Мониторинг ресурсов
docker stats

# Проверка метрик
curl https://supplierfinder.com/api/metrics
```

## 📞 Поддержка

### Контакты
- **Email**: support@supplierfinder.com
- **Телефон**: +7 (800) 123-45-67
- **Документация**: https://docs.supplierfinder.com

### Полезные команды
```bash
# Проверка статуса всех сервисов
docker-compose ps

# Перезапуск всех сервисов
docker-compose restart

# Просмотр логов
docker-compose logs -f

# Очистка неиспользуемых образов
docker system prune -a
```

---

**Продакшн готов!** 🚀 SupplierFinder успешно развернут и готов к использованию.


