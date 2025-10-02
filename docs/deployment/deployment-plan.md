# 📋 План развертывания SupplierFinder

## 🎯 Обзор

Детальный план развертывания SupplierFinder в продакшн среде с пошаговыми инструкциями и временными рамками.

## 📅 Временные рамки

### Фаза 1: Подготовка (1-2 дня)
- **День 1**: Подготовка инфраструктуры
- **День 2**: Настройка мониторинга и безопасности

### Фаза 2: Тестирование (1 день)
- **День 3**: Тестирование в staging среде

### Фаза 3: Развертывание (1 день)
- **День 4**: Развертывание в продакшн

### Фаза 4: Валидация (1 день)
- **День 5**: Проверка и оптимизация

## 🏗️ Инфраструктура

### 1. Требования к серверам

#### Production серверы
```yaml
# production-servers.yml
servers:
  app-servers:
    count: 3
    specs:
      cpu: 4 cores
      memory: 8GB
      disk: 100GB SSD
      os: Ubuntu 22.04 LTS
    
  database-servers:
    count: 2
    specs:
      cpu: 4 cores
      memory: 16GB
      disk: 500GB SSD
      os: Ubuntu 22.04 LTS
    
  cache-servers:
    count: 2
    specs:
      cpu: 2 cores
      memory: 4GB
      disk: 50GB SSD
      os: Ubuntu 22.04 LTS
```

#### Staging серверы
```yaml
# staging-servers.yml
servers:
  app-server:
    count: 1
    specs:
      cpu: 2 cores
      memory: 4GB
      disk: 50GB SSD
      os: Ubuntu 22.04 LTS
    
  database-server:
    count: 1
    specs:
      cpu: 2 cores
      memory: 8GB
      disk: 100GB SSD
      os: Ubuntu 22.04 LTS
```

### 2. Сетевая архитектура
```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
├─────────────────────────────────────────────────────────────┤
│                    Load Balancer                           │
│                  (Nginx/HAProxy)                           │
├─────────────────────────────────────────────────────────────┤
│  App Server 1  │  App Server 2  │  App Server 3           │
│  (10.0.1.10)   │  (10.0.1.11)   │  (10.0.1.12)            │
├─────────────────────────────────────────────────────────────┤
│  Database Primary  │  Database Replica  │  Cache Cluster  │
│  (10.0.2.10)       │  (10.0.2.11)       │  (10.0.3.10)    │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Подготовка инфраструктуры

### День 1: Настройка серверов

#### 1. Установка базового ПО
```bash
#!/bin/bash
# setup-servers.sh

# Обновление системы
sudo apt-get update && sudo apt-get upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Установка kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Установка Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

#### 2. Настройка сети
```bash
#!/bin/bash
# setup-network.sh

# Настройка firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 6443  # Kubernetes API
sudo ufw allow 2379:2380  # etcd
sudo ufw allow 10250  # kubelet
sudo ufw allow 10251  # kube-scheduler
sudo ufw allow 10252  # kube-controller-manager

# Настройка DNS
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
echo "nameserver 8.8.4.4" | sudo tee -a /etc/resolv.conf
```

#### 3. Настройка мониторинга
```bash
#!/bin/bash
# setup-monitoring.sh

# Создание директорий для мониторинга
sudo mkdir -p /opt/monitoring/{prometheus,grafana,alertmanager}
sudo chown -R 1000:1000 /opt/monitoring

# Настройка Prometheus
cat > /opt/monitoring/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'supplierfinder'
    static_configs:
      - targets: ['app-server:5000']
    metrics_path: '/api/metrics/prometheus'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['db-server:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['cache-server:6379']
EOF

# Настройка Grafana
cat > /opt/monitoring/grafana/grafana.ini << EOF
[server]
http_port = 3000
root_url = http://grafana.supplierfinder.com

[security]
admin_user = admin
admin_password = secure_password

[database]
type = sqlite3
path = grafana.db
EOF
```

### День 2: Настройка безопасности

#### 1. SSL сертификаты
```bash
#!/bin/bash
# setup-ssl.sh

# Установка Certbot
sudo apt-get install certbot python3-certbot-nginx -y

# Получение сертификатов
sudo certbot certonly --standalone -d supplierfinder.com -d www.supplierfinder.com

# Настройка автообновления
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

#### 2. Настройка базы данных
```bash
#!/bin/bash
# setup-database.sh

# Создание пользователя БД
sudo -u postgres createuser supplierfinder
sudo -u postgres createdb supplierfinder
sudo -u postgres psql -c "ALTER USER supplierfinder PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE supplierfinder TO supplierfinder;"

# Настройка PostgreSQL
sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = '2GB';"
sudo -u postgres psql -c "ALTER SYSTEM SET effective_cache_size = '6GB';"
sudo -u postgres psql -c "ALTER SYSTEM SET maintenance_work_mem = '512MB';"
sudo -u postgres psql -c "SELECT pg_reload_conf();"
```

## 🧪 Тестирование в staging

### День 3: Staging развертывание

#### 1. Развертывание staging
```bash
#!/bin/bash
# deploy-staging.sh

# Клонирование репозитория
git clone https://github.com/your-org/supplierfinder.git
cd supplierfinder

# Настройка переменных окружения
cp env.example .env.staging
cat > .env.staging << EOF
NODE_ENV=staging
PORT=5000
DATABASE_URL=postgresql://supplierfinder:secure_password@staging-db:5432/supplierfinder
REDIS_URL=redis://staging-cache:6379
TOKEN_SECRET=staging-token-secret
OPENAI_API_KEY=your-openai-key
YANDEX_API_KEY=your-yandex-key
GOOGLE_API_KEY=your-google-key
EOF

# Сборка и запуск
docker-compose -f docker-compose.staging.yml up -d

# Применение миграций
docker-compose exec app npm run db:migrate

# Заполнение тестовыми данными
docker-compose exec app npm run db:seed
```

#### 2. Тестирование функциональности
```bash
#!/bin/bash
# test-staging.sh

# Проверка health check
curl -f http://staging.supplierfinder.com/api/health

# Проверка API endpoints
curl -X POST http://staging.supplierfinder.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test123!"}'

# Проверка поиска поставщиков
curl -X POST http://staging.supplierfinder.com/api/supplier-search \
  -H "Content-Type: application/json" \
  -d '{"query":"electronics supplier","maxResults":10}'

# Проверка метрик
curl http://staging.supplierfinder.com/api/metrics
```

#### 3. Нагрузочное тестирование
```bash
#!/bin/bash
# load-test-staging.sh

# Установка k6
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Запуск нагрузочного тестирования
cat > load-test.js << EOF
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '2m', target: 0 },
  ],
};

export default function() {
  let response = http.get('http://staging.supplierfinder.com/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF

k6 run load-test.js
```

## 🚀 Продакшн развертывание

### День 4: Production развертывание

#### 1. Подготовка к развертыванию
```bash
#!/bin/bash
# prepare-production.sh

# Создание backup
sudo -u postgres pg_dump supplierfinder > backup_$(date +%Y%m%d_%H%M%S).sql

# Остановка старых сервисов (если есть)
sudo systemctl stop supplierfinder
sudo systemctl stop nginx

# Очистка старых контейнеров
docker system prune -a -f
```

#### 2. Развертывание приложения
```bash
#!/bin/bash
# deploy-production.sh

# Клонирование репозитория
git clone https://github.com/your-org/supplierfinder.git
cd supplierfinder

# Настройка переменных окружения
cp env.example .env.production
cat > .env.production << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://supplierfinder:secure_password@db:5432/supplierfinder
REDIS_URL=redis://redis:6379
TOKEN_SECRET=production-token-secret
OPENAI_API_KEY=your-openai-key
YANDEX_API_KEY=your-yandex-key
GOOGLE_API_KEY=your-google-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EOF

# Сборка и запуск
docker-compose -f docker-compose.prod.yml up -d

# Применение миграций
docker-compose exec app npm run db:migrate

# Создание индексов
docker-compose exec app npm run db:index
```

#### 3. Настройка Nginx
```bash
#!/bin/bash
# setup-nginx.sh

# Создание конфигурации Nginx
cat > /etc/nginx/sites-available/supplierfinder << EOF
upstream app {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name supplierfinder.com www.supplierfinder.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name supplierfinder.com www.supplierfinder.com;

    ssl_certificate /etc/letsencrypt/live/supplierfinder.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/supplierfinder.com/privkey.pem;

    location / {
        proxy_pass http://app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Активация сайта
sudo ln -s /etc/nginx/sites-available/supplierfinder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Валидация развертывания

### День 5: Проверка и оптимизация

#### 1. Проверка работоспособности
```bash
#!/bin/bash
# validate-deployment.sh

# Проверка health check
curl -f https://supplierfinder.com/api/health

# Проверка статуса
curl -f https://supplierfinder.com/api/status

# Проверка метрик
curl https://supplierfinder.com/api/metrics

# Проверка SSL
openssl s_client -connect supplierfinder.com:443 -servername supplierfinder.com

# Проверка производительности
curl -w "@curl-format.txt" -o /dev/null -s https://supplierfinder.com/api/health
```

#### 2. Мониторинг системы
```bash
#!/bin/bash
# monitor-system.sh

# Проверка ресурсов
docker stats

# Проверка логов
docker-compose logs -f app

# Проверка БД
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Проверка Redis
redis-cli info
```

#### 3. Оптимизация производительности
```bash
#!/bin/bash
# optimize-performance.sh

# Настройка PostgreSQL
sudo -u postgres psql -c "ANALYZE;"
sudo -u postgres psql -c "VACUUM ANALYZE;"

# Настройка Redis
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Настройка Nginx
sudo nginx -s reload
```

## 📊 Мониторинг и алерты

### 1. Настройка мониторинга
```bash
#!/bin/bash
# setup-monitoring.sh

# Запуск Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v /opt/monitoring/prometheus:/etc/prometheus \
  prom/prometheus

# Запуск Grafana
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -v /opt/monitoring/grafana:/var/lib/grafana \
  grafana/grafana

# Настройка алертов
cat > /opt/monitoring/alertmanager/alertmanager.yml << EOF
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@supplierfinder.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  email_configs:
  - to: 'admin@supplierfinder.com'
    subject: 'Alert: {{ .GroupLabels.alertname }}'
    body: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
EOF
```

### 2. Настройка алертов
```yaml
# alerts.yml
groups:
- name: supplierfinder
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 2000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}ms"

  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
      description: "PostgreSQL database is not responding"
```

## 🔄 План отката

### 1. Процедура отката
```bash
#!/bin/bash
# rollback.sh

# Остановка текущего развертывания
docker-compose down

# Восстановление из backup
sudo -u postgres psql supplierfinder < backup_$(date +%Y%m%d_%H%M%S).sql

# Запуск предыдущей версии
docker-compose -f docker-compose.previous.yml up -d

# Проверка работоспособности
curl -f https://supplierfinder.com/api/health
```

### 2. Критерии отката
- **Ошибки**: > 5% ошибок в течение 5 минут
- **Производительность**: Время ответа > 5 секунд
- **Доступность**: < 95% uptime
- **Безопасность**: Критические уязвимости

## 📋 Чеклист развертывания

### Предварительная подготовка
- [ ] Серверы подготовлены
- [ ] DNS настроен
- [ ] SSL сертификаты получены
- [ ] Мониторинг настроен
- [ ] Backup настроен

### Развертывание
- [ ] Код протестирован
- [ ] Docker образы собраны
- [ ] Переменные окружения настроены
- [ ] База данных настроена
- [ ] Приложение развернуто

### Проверка
- [ ] Health checks проходят
- [ ] API endpoints работают
- [ ] SSL сертификаты валидны
- [ ] Мониторинг активен
- [ ] Производительность в норме

### Пост-развертывание
- [ ] Документация обновлена
- [ ] Команда уведомлена
- [ ] Мониторинг настроен
- [ ] Алерты активны
- [ ] Backup работает

## 🚨 Устранение проблем

### Частые проблемы

#### 1. Проблемы с развертыванием
```bash
# Проверка статуса
docker-compose ps
docker-compose logs

# Перезапуск сервисов
docker-compose restart
docker-compose down && docker-compose up -d
```

#### 2. Проблемы с производительностью
```bash
# Мониторинг ресурсов
docker stats
htop
iostat -x 1

# Оптимизация
docker-compose exec app npm run db:optimize
redis-cli FLUSHALL
```

#### 3. Проблемы с сетью
```bash
# Проверка подключения
curl -I https://supplierfinder.com
telnet supplierfinder.com 443

# Проверка DNS
nslookup supplierfinder.com
dig supplierfinder.com
```

## 📞 Поддержка

### Контакты
- **Email**: devops@supplierfinder.com
- **Slack**: #deployment
- **PagerDuty**: Critical alerts

### Документация
- **Runbooks**: Операционные процедуры
- **Troubleshooting**: Руководство по устранению проблем
- **Monitoring**: Настройка мониторинга

---

**План развертывания готов!** 🚀 SupplierFinder готов к безопасному и надежному развертыванию в продакшн среде.


