# 🔄 Стратегия обновлений SupplierFinder

## 📋 Обзор

Комплексная стратегия обновления SupplierFinder с минимальным временем простоя и максимальной надежностью.

## 🎯 Принципы обновлений

### Основные принципы
- **Минимальный downtime**: < 5 минут простоя
- **Безопасность**: Откат в случае проблем
- **Тестирование**: Проверка в staging
- **Мониторинг**: Отслеживание состояния
- **Документация**: Обновление документации

### Типы обновлений
- **Patch**: Исправления багов (еженедельно)
- **Minor**: Новые функции (ежемесячно)
- **Major**: Крупные изменения (ежеквартально)
- **Security**: Критические исправления (немедленно)

## 🚀 Стратегии обновления

### 1. Blue-Green Deployment
```yaml
# blue-green-update.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: supplierfinder-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: supplierfinder
      version: blue
  template:
    metadata:
      labels:
        app: supplierfinder
        version: blue
    spec:
      containers:
      - name: app
        image: supplierfinder:v1.0.0
        ports:
        - containerPort: 5000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: supplierfinder-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: supplierfinder
      version: green
  template:
    metadata:
      labels:
        app: supplierfinder
        version: green
    spec:
      containers:
      - name: app
        image: supplierfinder:v1.1.0
        ports:
        - containerPort: 5000
```

### 2. Rolling Update
```yaml
# rolling-update.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: supplierfinder
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: supplierfinder
  template:
    metadata:
      labels:
        app: supplierfinder
    spec:
      containers:
      - name: app
        image: supplierfinder:v1.1.0
        ports:
        - containerPort: 5000
        readinessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
```

### 3. Canary Deployment
```yaml
# canary-update.yml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: supplierfinder
spec:
  replicas: 5
  strategy:
    canary:
      steps:
      - setWeight: 20
      - pause: {duration: 10m}
      - setWeight: 40
      - pause: {duration: 10m}
      - setWeight: 60
      - pause: {duration: 10m}
      - setWeight: 80
      - pause: {duration: 10m}
  selector:
    matchLabels:
      app: supplierfinder
  template:
    metadata:
      labels:
        app: supplierfinder
    spec:
      containers:
      - name: app
        image: supplierfinder:v1.1.0
        ports:
        - containerPort: 5000
```

## 🔄 Процесс обновления

### 1. Подготовка к обновлению

#### Проверка готовности
```bash
#!/bin/bash
# pre-update-check.sh

# Проверка текущего состояния
kubectl get pods -n supplierfinder
kubectl get services -n supplierfinder
kubectl get ingress -n supplierfinder

# Проверка ресурсов
kubectl top pods -n supplierfinder
kubectl top nodes

# Проверка логов
kubectl logs -l app=supplierfinder -n supplierfinder --tail=100

# Проверка метрик
curl -s https://supplierfinder.com/api/metrics | jq '.performance'
```

#### Создание backup
```bash
#!/bin/bash
# create-backup.sh

# Backup базы данных
kubectl exec -n supplierfinder deployment/postgres -- pg_dump -U postgres supplierfinder > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup конфигурации
kubectl get configmap -n supplierfinder -o yaml > configmap-backup.yaml
kubectl get secret -n supplierfinder -o yaml > secret-backup.yaml

# Backup приложения
docker save supplierfinder:current > supplierfinder-current.tar
```

### 2. Тестирование в staging

#### Развертывание в staging
```bash
#!/bin/bash
# deploy-staging.sh

# Обновление staging
kubectl set image deployment/supplierfinder-staging app=supplierfinder:v1.1.0 -n staging

# Ожидание готовности
kubectl rollout status deployment/supplierfinder-staging -n staging

# Проверка health check
curl -f http://staging.supplierfinder.com/api/health
```

#### Функциональное тестирование
```bash
#!/bin/bash
# test-staging.sh

# Тестирование API
curl -X POST http://staging.supplierfinder.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test123!"}'

# Тестирование поиска
curl -X POST http://staging.supplierfinder.com/api/supplier-search \
  -H "Content-Type: application/json" \
  -d '{"query":"electronics supplier","maxResults":10}'

# Тестирование AI анализа
curl -X POST http://staging.supplierfinder.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"electronics supplier requirements","type":"requirements"}'
```

#### Нагрузочное тестирование
```bash
#!/bin/bash
# load-test-staging.sh

# Запуск k6 тестов
k6 run --vus 50 --duration 5m load-test.js

# Проверка метрик
curl -s http://staging.supplierfinder.com/api/metrics | jq '.performance'
```

### 3. Продакшн обновление

#### Blue-Green обновление
```bash
#!/bin/bash
# blue-green-update.sh

# Получение текущего цвета
CURRENT_COLOR=$(kubectl get service supplierfinder-service -n supplierfinder -o jsonpath='{.spec.selector.version}')

# Определение нового цвета
if [ "$CURRENT_COLOR" = "blue" ]; then
    NEW_COLOR="green"
else
    NEW_COLOR="blue"
fi

# Развертывание нового цвета
kubectl set image deployment/supplierfinder-$NEW_COLOR app=supplierfinder:v1.1.0 -n supplierfinder

# Ожидание готовности
kubectl rollout status deployment/supplierfinder-$NEW_COLOR -n supplierfinder

# Переключение трафика
kubectl patch service supplierfinder-service -n supplierfinder -p '{"spec":{"selector":{"version":"'$NEW_COLOR'"}}}'

# Проверка работоспособности
curl -f https://supplierfinder.com/api/health
```

#### Rolling обновление
```bash
#!/bin/bash
# rolling-update.sh

# Обновление образа
kubectl set image deployment/supplierfinder app=supplierfinder:v1.1.0 -n supplierfinder

# Ожидание завершения
kubectl rollout status deployment/supplierfinder -n supplierfinder

# Проверка работоспособности
curl -f https://supplierfinder.com/api/health
```

#### Canary обновление
```bash
#!/bin/bash
# canary-update.sh

# Запуск canary
kubectl patch rollout supplierfinder -n supplierfinder -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","image":"supplierfinder:v1.1.0"}]}}}}'

# Мониторинг метрик
watch -n 5 'curl -s https://supplierfinder.com/api/metrics | jq ".performance"'

# Постепенное увеличение трафика
kubectl patch rollout supplierfinder -n supplierfinder -p '{"spec":{"strategy":{"canary":{"steps":[{"setWeight":20}]}}}}'
```

### 4. Валидация обновления

#### Проверка работоспособности
```bash
#!/bin/bash
# validate-update.sh

# Health check
curl -f https://supplierfinder.com/api/health

# Status check
curl -f https://supplierfinder.com/api/status

# Metrics check
curl -s https://supplierfinder.com/api/metrics | jq '.performance'

# Database check
kubectl exec -n supplierfinder deployment/postgres -- psql -U postgres -d supplierfinder -c "SELECT COUNT(*) FROM users;"

# Cache check
kubectl exec -n supplierfinder deployment/redis -- redis-cli ping
```

#### Мониторинг производительности
```bash
#!/bin/bash
# monitor-performance.sh

# Мониторинг ресурсов
kubectl top pods -n supplierfinder
kubectl top nodes

# Мониторинг логов
kubectl logs -l app=supplierfinder -n supplierfinder --tail=100 -f

# Мониторинг метрик
watch -n 5 'curl -s https://supplierfinder.com/api/metrics | jq ".performance"'
```

## 🔄 Откат обновления

### 1. Критерии отката
- **Ошибки**: > 5% ошибок в течение 5 минут
- **Производительность**: Время ответа > 5 секунд
- **Доступность**: < 95% uptime
- **Безопасность**: Критические уязвимости

### 2. Процедура отката

#### Blue-Green откат
```bash
#!/bin/bash
# blue-green-rollback.sh

# Получение текущего цвета
CURRENT_COLOR=$(kubectl get service supplierfinder-service -n supplierfinder -o jsonpath='{.spec.selector.version}')

# Определение предыдущего цвета
if [ "$CURRENT_COLOR" = "blue" ]; then
    PREVIOUS_COLOR="green"
else
    PREVIOUS_COLOR="blue"
fi

# Переключение на предыдущий цвет
kubectl patch service supplierfinder-service -n supplierfinder -p '{"spec":{"selector":{"version":"'$PREVIOUS_COLOR'"}}}'

# Проверка работоспособности
curl -f https://supplierfinder.com/api/health
```

#### Rolling откат
```bash
#!/bin/bash
# rolling-rollback.sh

# Откат к предыдущей версии
kubectl rollout undo deployment/supplierfinder -n supplierfinder

# Ожидание завершения
kubectl rollout status deployment/supplierfinder -n supplierfinder

# Проверка работоспособности
curl -f https://supplierfinder.com/api/health
```

#### Canary откат
```bash
#!/bin/bash
# canary-rollback.sh

# Откат canary
kubectl patch rollout supplierfinder -n supplierfinder -p '{"spec":{"template":{"spec":{"containers":[{"name":"app","image":"supplierfinder:v1.0.0"}]}}}}'

# Ожидание завершения
kubectl rollout status rollout/supplierfinder -n supplierfinder

# Проверка работоспособности
curl -f https://supplierfinder.com/api/health
```

## 📊 Мониторинг обновлений

### 1. Метрики для мониторинга
- **Error Rate**: Процент ошибок
- **Response Time**: Время ответа
- **Throughput**: Пропускная способность
- **CPU Usage**: Использование CPU
- **Memory Usage**: Использование памяти
- **Database Connections**: Подключения к БД

### 2. Алерты
```yaml
# update-alerts.yml
groups:
- name: update-monitoring
  rules:
  - alert: UpdateHighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate after update"
      description: "Error rate is {{ $value }} errors per second"

  - alert: UpdateHighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 3000
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High response time after update"
      description: "95th percentile response time is {{ $value }}ms"

  - alert: UpdateLowThroughput
    expr: rate(http_requests_total[5m]) < 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Low throughput after update"
      description: "Throughput is {{ $value }} requests per second"
```

### 3. Дашборд обновлений
```json
{
  "dashboard": {
    "title": "Update Monitoring",
    "panels": [
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "{{status}}"
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
      },
      {
        "title": "Throughput",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      }
    ]
  }
}
```

## 🔄 Автоматизация обновлений

### 1. CI/CD Pipeline
```yaml
# .github/workflows/update.yml
name: Update Production

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:integration

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t supplierfinder:${{ github.sha }} .
      - name: Push to registry
        run: docker push registry/supplierfinder:${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: |
          kubectl set image deployment/supplierfinder-staging \
            app=registry/supplierfinder:${{ github.sha }} -n staging
          kubectl rollout status deployment/supplierfinder-staging -n staging

  test-staging:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - name: Run staging tests
        run: |
          curl -f http://staging.supplierfinder.com/api/health
          npm run test:e2e -- --baseUrl=http://staging.supplierfinder.com

  deploy-production:
    needs: test-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          kubectl set image deployment/supplierfinder \
            app=registry/supplierfinder:${{ github.sha }} -n supplierfinder
          kubectl rollout status deployment/supplierfinder -n supplierfinder

  monitor:
    needs: deploy-production
    runs-on: ubuntu-latest
    steps:
      - name: Monitor deployment
        run: |
          for i in {1..10}; do
            curl -f https://supplierfinder.com/api/health
            sleep 30
          done
```

### 2. Автоматический откат
```bash
#!/bin/bash
# auto-rollback.sh

# Мониторинг метрик в течение 10 минут
for i in {1..20}; do
  ERROR_RATE=$(curl -s https://supplierfinder.com/api/metrics | jq '.performance.errors.rate')
  RESPONSE_TIME=$(curl -s https://supplierfinder.com/api/metrics | jq '.performance.responseTime.average')
  
  if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
    echo "High error rate detected: $ERROR_RATE"
    kubectl rollout undo deployment/supplierfinder -n supplierfinder
    exit 1
  fi
  
  if (( $(echo "$RESPONSE_TIME > 3000" | bc -l) )); then
    echo "High response time detected: $RESPONSE_TIME"
    kubectl rollout undo deployment/supplierfinder -n supplierfinder
    exit 1
  fi
  
  sleep 30
done

echo "Update successful"
```

## 📋 Чеклист обновления

### Предварительная подготовка
- [ ] Код протестирован
- [ ] Staging развернут
- [ ] Backup создан
- [ ] Мониторинг настроен
- [ ] Команда уведомлена

### Обновление
- [ ] Staging тестирование пройдено
- [ ] Продакшн обновление выполнено
- [ ] Health checks проходят
- [ ] Метрики в норме
- [ ] Пользователи могут войти

### Пост-обновление
- [ ] Мониторинг активен
- [ ] Алерты настроены
- [ ] Документация обновлена
- [ ] Команда уведомлена
- [ ] Backup обновлен

## 🚨 Устранение проблем

### Частые проблемы

#### 1. Проблемы с обновлением
```bash
# Проверка статуса
kubectl get pods -n supplierfinder
kubectl describe pod <pod-name> -n supplierfinder

# Просмотр логов
kubectl logs <pod-name> -n supplierfinder

# Откат
kubectl rollout undo deployment/supplierfinder -n supplierfinder
```

#### 2. Проблемы с производительностью
```bash
# Мониторинг ресурсов
kubectl top pods -n supplierfinder
kubectl top nodes

# Масштабирование
kubectl scale deployment supplierfinder --replicas=5 -n supplierfinder
```

#### 3. Проблемы с базой данных
```bash
# Проверка БД
kubectl exec -n supplierfinder deployment/postgres -- psql -U postgres -d supplierfinder -c "SELECT COUNT(*) FROM users;"

# Восстановление из backup
kubectl exec -n supplierfinder deployment/postgres -- psql -U postgres -d supplierfinder < backup.sql
```

## 📞 Поддержка

### Контакты
- **Email**: devops@supplierfinder.com
- **Slack**: #deployment
- **PagerDuty**: Critical alerts

### Документация
- **Update Runbooks**: Процедуры обновления
- **Rollback Procedures**: Процедуры отката
- **Monitoring**: Настройка мониторинга

---

**Стратегия обновлений готова!** 🔄 SupplierFinder готов к безопасным и надежным обновлениям в продакшн среде.


