# PowerShell скрипт для создания резервных копий
# Использование: .\backup.ps1 [version-name]

param(
    [string]$Version = "v$(Get-Date -Format 'yyyyMMdd-HHmm')"
)

Write-Host "💾 Создание резервной копии версии: $Version" -ForegroundColor Yellow

# Создание директорий для версии
$versionDirs = @(
    "auth-backup",
    "middleware-backup", 
    "schema-backup",
    "config-backup"
)

foreach ($dir in $versionDirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# Функция для безопасного копирования
function Backup-File {
    param($Source, $Destination)
    
    if (Test-Path $Source) {
        Copy-Item $Source $Destination -Force
        Write-Host "✅ Резервная копия: $Source -> $Destination" -ForegroundColor Green
    } else {
        Write-Host "❌ Файл не найден: $Source" -ForegroundColor Red
    }
}

# Резервное копирование auth.ts
Write-Host "`n🔐 Резервное копирование системы аутентификации..." -ForegroundColor Cyan
$authSource = "..\server\auth.ts"
$authDest = "auth-backup\auth-$Version.ts"
Backup-File $authSource $authDest

# Резервное копирование middleware
Write-Host "`n🛡️ Резервное копирование middleware..." -ForegroundColor Cyan
$middlewareSource = "..\server\middleware\requireAuth.ts"
$middlewareDest = "middleware-backup\requireAuth-$Version.ts"
Backup-File $middlewareSource $middlewareDest

# Резервное копирование схемы БД
Write-Host "`n🗄️ Резервное копирование схемы базы данных..." -ForegroundColor Cyan
$schemaSource = "..\shared\schema.ts"
$schemaDest = "schema-backup\schema-$Version.ts"
Backup-File $schemaSource $schemaDest

# Резервное копирование конфигурации
Write-Host "`n📦 Резервное копирование конфигурации..." -ForegroundColor Cyan
$packageSource = "..\package.json"
$packageDest = "config-backup\package-$Version.json"
Backup-File $packageSource $packageDest

# Создание файла с информацией о версии
$versionInfo = @"
# Информация о версии: $Version
Дата создания: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Автор: $(whoami)
Описание: Резервная копия перед внесением изменений в систему аутентификации

## Изменения в этой версии:
- [ ] Описание изменений

## Тестирование:
- [ ] Функциональность входа
- [ ] Функциональность регистрации  
- [ ] Управление сессиями
- [ ] API аутентификация

## Статус:
- [ ] Протестировано
- [ ] Готово к продакшену
"@

$versionInfo | Out-File -FilePath "version-$Version.md" -Encoding UTF8

Write-Host "`n✅ Резервная копия создана успешно!" -ForegroundColor Green
Write-Host "📝 Информация о версии сохранена в: version-$Version.md" -ForegroundColor Cyan

# Показать список доступных версий
Write-Host "`n📋 Доступные версии для отката:" -ForegroundColor Yellow
Get-ChildItem -Path "auth-backup" -Filter "auth-*.ts" | ForEach-Object {
    $version = $_.Name -replace "auth-", "" -replace ".ts", ""
    Write-Host "  - $version" -ForegroundColor White
}
