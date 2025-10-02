# 🚀 Стратегия развертывания SupplierFinder

## 📋 Обзор

Комплексная стратегия развертывания SupplierFinder в продакшн среде с учетом масштабируемости, надежности и безопасности.

## 🎯 Цели развертывания

### Основные цели
- **Высокая доступность**: 99.9% uptime
- **Масштабируемость**: Поддержка роста нагрузки
- **Безопасность**: Защита данных и системы
- **Производительность**: Быстрый отклик системы
- **Надежность**: Отказоустойчивость

### Технические требования
- **Время развертывания**: < 30 минут
- **Время отката**: < 10 минут
- **Время восстановления**: < 5 минут
- **Пропускная способность**: > 1000 RPS
- **Время ответа**: < 2 секунды

## 🏗️ Архитектура развертывания

### 1. Многоуровневая архитектура
```
┌─────────────────────────────────────────────────────────────┐
│                        CDN Layer                           │
├─────────────────────────────────────────────────────────────┤
│                    Load Balancer                          │
├─────────────────────────────────────────────────────────────┤
│  App Tier 1  │  App Tier 2  │  App Tier 3  │  App Tier N  │
├─────────────────────────────────────────────────────────────┤
│                    Database Tier                           │
├─────────────────────────────────────────────────────────────┤
│  Primary DB  │  Replica DB  │  Backup DB   │  Cache DB    │
├─────────────────────────────────────────────────────────────┤
│                    Storage Tier                            │
├─────────────────────────────────────────────────────────────┤
│  File Storage  │  Log Storage  │  Backup Storage           │
└─────────────────────────────────────────────────────────────┘
```

### 2. Компоненты инфраструктуры
- **CDN**: CloudFlare или AWS CloudFront
- **Load Balancer**: Nginx или AWS ALB
- **Application Servers**: Docker контейнеры
- **Database**: PostgreSQL кластер
- **Cache**: Redis кластер
- **Storage**: S3-совместимое хранилище
- **Monitoring**: Prometheus + Grafana

## 🚀 Стратегии развертывания

### 1. Blue-Green Deployment
```yaml
# blue-green-deployment.yml
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
        image: supplierfinder:blue
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
        image: supplierfinder:green
        ports:
        - containerPort: 5000
```

### 2. Rolling Deployment
```yaml
# rolling-deployment.yml
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
        image: supplierfinder:latest
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
# canary-deployment.yml
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
        image: supplierfinder:latest
        ports:
        - containerPort: 5000
```

## 🐳 Контейнеризация

### 1. Dockerfile оптимизация
```dockerfile
# Multi-stage build для оптимизации размера
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Копируем исходный код
COPY . .

# Сборка приложения
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Создаем пользователя
RUN addgroup -g 1001 -S nodejs
RUN adduser -S supplierfinder -u 1001

WORKDIR /app

# Копируем только необходимые файлы
COPY --from=builder --chown=supplierfinder:nodejs /app/dist ./dist
COPY --from=builder --chown=supplierfinder:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=supplierfinder:nodejs /app/package*.json ./

# Переключаемся на пользователя
USER supplierfinder

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server/index.js"]
```

### 2. Docker Compose для продакшна
```yaml
# docker-compose.prod.yml
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
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

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
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
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
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
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
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

volumes:
  postgres_data:
  redis_data:
```

## ☸️ Kubernetes развертывание

### 1. Namespace и ConfigMap
```yaml
# namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: supplierfinder
---
# configmap.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: supplierfinder-config
  namespace: supplierfinder
data:
  NODE_ENV: "production"
  PORT: "5000"
  LOG_LEVEL: "info"
  MONITORING_ENABLED: "true"
```

### 2. Secrets
```yaml
# secrets.yml
apiVersion: v1
kind: Secret
metadata:
  name: supplierfinder-secrets
  namespace: supplierfinder
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  TOKEN_SECRET: <base64-encoded-token-secret>
  OPENAI_API_KEY: <base64-encoded-openai-key>
  YANDEX_API_KEY: <base64-encoded-yandex-key>
  GOOGLE_API_KEY: <base64-encoded-google-key>
```

### 3. Deployment
```yaml
# deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: supplierfinder
  namespace: supplierfinder
spec:
  replicas: 3
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
        image: supplierfinder:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: supplierfinder-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: supplierfinder-secrets
              key: DATABASE_URL
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
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

### 4. Service
```yaml
# service.yml
apiVersion: v1
kind: Service
metadata:
  name: supplierfinder-service
  namespace: supplierfinder
spec:
  selector:
    app: supplierfinder
  ports:
  - port: 80
    targetPort: 5000
  type: ClusterIP
```

### 5. Ingress
```yaml
# ingress.yml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: supplierfinder-ingress
  namespace: supplierfinder
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - supplierfinder.com
    secretName: supplierfinder-tls
  rules:
  - host: supplierfinder.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: supplierfinder-service
            port:
              number: 80
```

## 🔄 CI/CD Pipeline

### 1. GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run security audit
        run: npm audit --audit-level high

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBE_CONFIG }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/supplierfinder \
            app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
            -n supplierfinder

      - name: Wait for deployment
        run: |
          kubectl rollout status deployment/supplierfinder -n supplierfinder

      - name: Run health check
        run: |
          kubectl get pods -n supplierfinder
          kubectl get services -n supplierfinder
```

### 2. GitLab CI/CD
```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

test:
  stage: test
  image: node:18-alpine
  script:
    - npm ci
    - npm test
    - npm run lint
    - npm run type-check
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main

deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/supplierfinder app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -n supplierfinder
    - kubectl rollout status deployment/supplierfinder -n supplierfinder
  only:
    - main
```

## 🔒 Безопасность развертывания

### 1. Secrets Management
```yaml
# secrets-management.yml
apiVersion: v1
kind: Secret
metadata:
  name: supplierfinder-secrets
  namespace: supplierfinder
type: Opaque
data:
  # Base64 encoded secrets
  DATABASE_URL: <base64-encoded>
  TOKEN_SECRET: <base64-encoded>
  OPENAI_API_KEY: <base64-encoded>
```

### 2. Network Policies
```yaml
# network-policy.yml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: supplierfinder-network-policy
  namespace: supplierfinder
spec:
  podSelector:
    matchLabels:
      app: supplierfinder
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 5000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: postgres
    ports:
    - protocol: TCP
      port: 5432
```

### 3. Pod Security Policy
```yaml
# pod-security-policy.yml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: supplierfinder-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## 📊 Мониторинг развертывания

### 1. Health Checks
```yaml
# health-checks.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: health-checks
  namespace: supplierfinder
data:
  health-check.sh: |
    #!/bin/bash
    curl -f http://localhost:5000/api/health || exit 1
    curl -f http://localhost:5000/api/status || exit 1
```

### 2. Monitoring Stack
```yaml
# monitoring-stack.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'supplierfinder'
      static_configs:
      - targets: ['supplierfinder-service:80']
      metrics_path: '/api/metrics/prometheus'
```

## 🚀 Стратегии масштабирования

### 1. Horizontal Pod Autoscaler
```yaml
# hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: supplierfinder-hpa
  namespace: supplierfinder
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: supplierfinder
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 2. Vertical Pod Autoscaler
```yaml
# vpa.yml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: supplierfinder-vpa
  namespace: supplierfinder
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: supplierfinder
  updatePolicy:
    updateMode: "Auto"
```

## 🔄 Стратегии отката

### 1. Blue-Green Rollback
```bash
#!/bin/bash
# blue-green-rollback.sh

# Получаем текущую версию
CURRENT_VERSION=$(kubectl get deployment supplierfinder -n supplierfinder -o jsonpath='{.spec.template.spec.containers[0].image}')

# Откатываемся к предыдущей версии
kubectl set image deployment/supplierfinder app=supplierfinder:previous -n supplierfinder

# Ждем завершения отката
kubectl rollout status deployment/supplierfinder -n supplierfinder

echo "Rollback completed to previous version"
```

### 2. Rolling Rollback
```bash
#!/bin/bash
# rolling-rollback.sh

# Откатываемся к предыдущей версии
kubectl rollout undo deployment/supplierfinder -n supplierfinder

# Ждем завершения отката
kubectl rollout status deployment/supplierfinder -n supplierfinder

echo "Rolling rollback completed"
```

## 📋 Чеклист развертывания

### Предварительная подготовка
- [ ] Инфраструктура готова
- [ ] SSL сертификаты получены
- [ ] DNS настроен
- [ ] Мониторинг настроен
- [ ] Резервное копирование настроено

### Развертывание
- [ ] Код протестирован
- [ ] Docker образы собраны
- [ ] Kubernetes манифесты готовы
- [ ] Secrets настроены
- [ ] Развертывание выполнено

### Проверка
- [ ] Health checks проходят
- [ ] Мониторинг работает
- [ ] Логи собираются
- [ ] Метрики доступны
- [ ] Пользователи могут войти

### Пост-развертывание
- [ ] Мониторинг активен
- [ ] Алерты настроены
- [ ] Документация обновлена
- [ ] Команда уведомлена

## 🚨 Устранение проблем

### Частые проблемы

#### 1. Проблемы с развертыванием
```bash
# Проверка статуса
kubectl get pods -n supplierfinder
kubectl describe pod <pod-name> -n supplierfinder

# Просмотр логов
kubectl logs <pod-name> -n supplierfinder

# Перезапуск
kubectl rollout restart deployment/supplierfinder -n supplierfinder
```

#### 2. Проблемы с производительностью
```bash
# Проверка ресурсов
kubectl top pods -n supplierfinder
kubectl top nodes

# Масштабирование
kubectl scale deployment supplierfinder --replicas=5 -n supplierfinder
```

#### 3. Проблемы с сетью
```bash
# Проверка сервисов
kubectl get services -n supplierfinder
kubectl get ingress -n supplierfinder

# Тестирование подключения
kubectl exec -it <pod-name> -n supplierfinder -- curl http://localhost:5000/api/health
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

**Стратегия развертывания готова!** 🚀 SupplierFinder готов к безопасному и надежному развертыванию в продакшн среде.


