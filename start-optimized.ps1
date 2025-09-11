# Оптимизированный скрипт запуска для быстрого старта
Write-Host "🚀 Запуск оптимизированного сервера SupplierFinder..." -ForegroundColor Green

# Устанавливаем переменные окружения для оптимизации
$env:NODE_ENV = "development"
$env:SKIP_AUTH = "true"
$env:DEV_MODE = "true"
$env:DATABASE_URL = "postgresql://neondb_owner:npg_w6m4xfJLtiUG@ep-jolly-firefly-a4a5r2fx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Оптимизируем Node.js для быстрого запуска
$env:NODE_OPTIONS = "--max-old-space-size=2048 --optimize-for-size"

Write-Host "✅ Переменные окружения установлены" -ForegroundColor Cyan
Write-Host "⚡ Запуск сервера с оптимизациями..." -ForegroundColor Yellow

# Запускаем сервер
npm run dev
