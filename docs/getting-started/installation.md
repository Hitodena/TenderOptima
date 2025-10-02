# 🚀 Установка и настройка SupplierFinder

## 📋 Предварительные требования

### Системные требования
- **Node.js**: 18.0.0 или выше
- **PostgreSQL**: 14.0 или выше
- **npm**: 8.0.0 или выше
- **Git**: 2.30.0 или выше

### Операционные системы
- **Windows**: 10 или выше
- **macOS**: 10.15 или выше
- **Linux**: Ubuntu 20.04+ или эквивалент

### Рекомендуемые ресурсы
- **RAM**: 4GB минимум, 8GB рекомендуется
- **CPU**: 2 ядра минимум, 4 ядра рекомендуется
- **Диск**: 10GB свободного места
- **Сеть**: Стабильное интернет-соединение

## 🔧 Установка

### 1. Клонирование репозитория
```bash
# Клонирование репозитория
git clone https://github.com/your-org/supplierfinder.git
cd supplierfinder

# Проверка версии Node.js
node --version
# Должно быть 18.0.0 или выше

# Проверка версии npm
npm --version
# Должно быть 8.0.0 или выше
```

### 2. Установка зависимостей
```bash
# Установка зависимостей
npm install

# Проверка установки
npm list --depth=0
```

### 3. Настройка окружения
```bash
# Копирование файла окружения
cp env.example .env

# Редактирование переменных окружения
nano .env
# или
code .env
```

### 4. Настройка базы данных
```bash
# Установка PostgreSQL (если не установлен)
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Windows
# Скачайте с https://www.postgresql.org/download/windows/

# Создание базы данных
sudo -u postgres createdb supplierfinder
sudo -u postgres createdb supplierfinder_test

# Настройка пользователя
sudo -u postgres psql
CREATE USER supplierfinder WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE supplierfinder TO supplierfinder;
GRANT ALL PRIVILEGES ON DATABASE supplierfinder_test TO supplierfinder;
\q
```

### 5. Настройка переменных окружения
```bash
# .env файл
DATABASE_URL=postgresql://supplierfinder:your_password@localhost:5432/supplierfinder
TEST_DATABASE_URL=postgresql://supplierfinder:your_password@localhost:5432/supplierfinder_test
TOKEN_SECRET=your-secure-token-secret-here
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# OpenAI API
OPENAI_API_KEY=your-openai-api-key-here

# Email настройки
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Yandex API
YANDEX_API_KEY=your-yandex-api-key-here
YANDEX_SEARCH_ID=your-yandex-search-id-here

# Google API
GOOGLE_API_KEY=your-google-api-key-here
GOOGLE_SEARCH_ENGINE_ID=your-google-search-engine-id-here
```

## 🗄️ Настройка базы данных

### 1. Запуск миграций
```bash
# Генерация миграций
npm run db:generate

# Применение миграций
npm run db:migrate

# Проверка статуса
npm run db:status
```

### 2. Создание индексов
```bash
# Создание индексов для оптимизации
npm run db:index

# Проверка индексов
npm run db:check-indexes
```

### 3. Заполнение тестовыми данными
```bash
# Заполнение тестовыми данными (опционально)
npm run db:seed

# Очистка тестовых данных
npm run db:clean
```

## 🚀 Запуск приложения

### 1. Режим разработки
```bash
# Запуск в режиме разработки
npm run dev

# Или запуск отдельных компонентов
npm run dev:client  # Только клиент
npm run dev:server  # Только сервер
```

### 2. Режим продакшна
```bash
# Сборка приложения
npm run build

# Запуск в продакшне
npm start
```

### 3. Проверка работоспособности
```bash
# Проверка здоровья системы
curl http://localhost:5000/api/health

# Проверка статуса
curl http://localhost:5000/api/status

# Проверка метрик
curl http://localhost:5000/api/metrics
```

## 🔧 Настройка разработки

### 1. Настройка IDE
```bash
# VS Code расширения
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-eslint
```

### 2. Настройка линтеров
```bash
# Установка линтеров
npm install -D eslint prettier @typescript-eslint/eslint-plugin

# Настройка ESLint
npx eslint --init

# Настройка Prettier
echo '{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80
}' > .prettierrc
```

### 3. Настройка Git hooks
```bash
# Установка Husky
npm install -D husky lint-staged

# Настройка pre-commit hook
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

## 🧪 Тестирование

### 1. Запуск тестов
```bash
# Все тесты
npm test

# Конкретные категории
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:security
npm run test:monitoring
npm run test:final
```

### 2. Покрытие кода
```bash
# Генерация отчета о покрытии
npm run test:coverage

# Просмотр отчета
open coverage/index.html
```

### 3. Линтинг
```bash
# Проверка кода
npm run lint

# Автоисправление
npm run lint:fix

# Проверка типов
npm run type-check
```

## 🐳 Docker (опционально)

### 1. Создание Dockerfile
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

### 2. Docker Compose
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
      - DATABASE_URL=postgresql://postgres:password@db:5432/supplierfinder
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=supplierfinder
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 3. Запуск с Docker
```bash
# Сборка и запуск
docker-compose up -d

# Проверка логов
docker-compose logs -f

# Остановка
docker-compose down
```

## 🔍 Проверка установки

### 1. Проверка зависимостей
```bash
# Проверка установленных пакетов
npm list --depth=0

# Проверка уязвимостей
npm audit

# Исправление уязвимостей
npm audit fix
```

### 2. Проверка базы данных
```bash
# Подключение к БД
psql -h localhost -U supplierfinder -d supplierfinder

# Проверка таблиц
\dt

# Проверка миграций
SELECT * FROM drizzle_migrations;
```

### 3. Проверка API
```bash
# Проверка endpoints
curl http://localhost:5000/api/health
curl http://localhost:5000/api/status
curl http://localhost:5000/api/metrics
```

## 🚨 Устранение проблем

### Частые проблемы

#### 1. Ошибка подключения к БД
```bash
# Проверка статуса PostgreSQL
sudo systemctl status postgresql

# Перезапуск PostgreSQL
sudo systemctl restart postgresql

# Проверка подключения
psql -h localhost -U supplierfinder -d supplierfinder
```

#### 2. Ошибки миграций
```bash
# Сброс миграций
npm run db:reset

# Применение миграций заново
npm run db:migrate
```

#### 3. Ошибки сборки
```bash
# Очистка кэша
npm run clean

# Переустановка зависимостей
rm -rf node_modules package-lock.json
npm install
```

#### 4. Ошибки тестов
```bash
# Очистка тестовой БД
npm run test:clean

# Запуск тестов с отладкой
npm run test -- --verbose
```

## 📞 Поддержка

### Получение помощи
- **Документация**: [docs/README.md](../README.md)
- **FAQ**: [docs/support/faq.md](../support/faq.md)
- **GitHub Issues**: [Создать issue](https://github.com/your-org/supplierfinder/issues)
- **Discord**: [Присоединиться](https://discord.gg/supplierfinder)

### Полезные команды
```bash
# Проверка версий
node --version
npm --version
psql --version

# Проверка портов
netstat -tulpn | grep :5000
netstat -tulpn | grep :3000

# Проверка процессов
ps aux | grep node
ps aux | grep postgres
```

---

**Установка завершена!** 🎉 Теперь вы можете перейти к [первым шагам](first-steps.md).


