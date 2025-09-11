# PowerShell скрипт для отката изменений
# Использование: .\rollback.ps1 [version]

param(
    [string]$Version = "original"
)

Write-Host "🔄 Начинаем откат к версии: $Version" -ForegroundColor Yellow

# Функция для безопасного копирования
function Copy-Safe {
    param($Source, $Destination)
    
    if (Test-Path $Source) {
        Copy-Item $Source $Destination -Force
        Write-Host "✅ Скопировано: $Source -> $Destination" -ForegroundColor Green
    } else {
        Write-Host "❌ Файл не найден: $Source" -ForegroundColor Red
    }
}

# Откат auth.ts
Write-Host "`n🔐 Откат системы аутентификации..." -ForegroundColor Cyan
$authSource = "auth-backup\auth-$Version.ts"
$authDest = "..\server\auth.ts"
Copy-Safe $authSource $authDest

# Откат middleware
Write-Host "`n🛡️ Откат middleware..." -ForegroundColor Cyan
$middlewareSource = "middleware-backup\requireAuth-$Version.ts"
$middlewareDest = "..\server\middleware\requireAuth.ts"
Copy-Safe $middlewareSource $middlewareDest

# Откат схемы БД (если нужно)
if ($Version -eq "original") {
    Write-Host "`n🗄️ Откат схемы базы данных..." -ForegroundColor Cyan
    $schemaSource = "schema-backup\schema-$Version.ts"
    $schemaDest = "..\shared\schema.ts"
    Copy-Safe $schemaSource $schemaDest
}

# Откат package.json (если нужно)
if ($Version -eq "original") {
    Write-Host "`n📦 Откат конфигурации..." -ForegroundColor Cyan
    $packageSource = "config-backup\package-$Version.json"
    $packageDest = "..\package.json"
    Copy-Safe $packageSource $packageDest
}

Write-Host "`n✅ Откат завершен!" -ForegroundColor Green
Write-Host "🔄 Перезапустите сервер: npm run dev" -ForegroundColor Yellow

# Предложение перезапуска
$restart = Read-Host "`nПерезапустить сервер сейчас? (y/n)"
if ($restart -eq "y" -or $restart -eq "Y") {
    Write-Host "🚀 Перезапуск сервера..." -ForegroundColor Green
    Set-Location ..
    npm run dev
}
