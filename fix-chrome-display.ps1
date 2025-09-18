# PowerShell script to quickly fix Chrome display issues
# This script provides multiple solutions for Chrome caching problems

Write-Host "🔧 Исправление проблем с отображением в Chrome" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan

Write-Host "`n📋 Доступные решения:" -ForegroundColor Yellow
Write-Host "1. Очистить кэш Chrome (рекомендуется)" -ForegroundColor White
Write-Host "2. Открыть в режиме инкогнито" -ForegroundColor White
Write-Host "3. Выполнить жесткую перезагрузку" -ForegroundColor White
Write-Host "4. Очистить данные сайта" -ForegroundColor White
Write-Host "5. Перезапустить сервер разработки" -ForegroundColor White
Write-Host "6. Проверить консоль разработчика" -ForegroundColor White

Write-Host "`n🚀 Автоматические действия:" -ForegroundColor Cyan

# 1. Перезапуск сервера разработки
Write-Host "`n🔄 Перезапуск сервера разработки..." -ForegroundColor Yellow
try {
    # Останавливаем существующие процессы Node.js
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*server*" } | Stop-Process -Force
    Start-Sleep -Seconds 2
    
    Write-Host "✅ Процессы Node.js остановлены" -ForegroundColor Green
    
    # Запускаем сервер заново
    Write-Host "🚀 Запуск сервера разработки..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-Command", "cd '$PSScriptRoot'; npm run dev" -WindowStyle Minimized
    
    Write-Host "✅ Сервер разработки запущен" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Не удалось автоматически перезапустить сервер" -ForegroundColor Yellow
    Write-Host "   Запустите вручную: npm run dev" -ForegroundColor White
}

# 2. Открытие Chrome с параметрами для отключения кэша
Write-Host "`n🌐 Открытие Chrome с отключенным кэшем..." -ForegroundColor Yellow
try {
    $chromeArgs = @(
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-field-trial-config",
        "--disable-back-forward-cache",
        "--disable-ipc-flooding-protection",
        "--aggressive-cache-discard",
        "--disable-background-networking",
        "http://localhost:5000"
    )
    
    Start-Process "chrome.exe" -ArgumentList $chromeArgs
    Write-Host "✅ Chrome открыт с отключенным кэшем" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Не удалось автоматически открыть Chrome" -ForegroundColor Yellow
    Write-Host "   Откройте Chrome вручную и перейдите на http://localhost:5000" -ForegroundColor White
}

Write-Host "`n📝 Ручные действия для решения проблемы:" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Gray

Write-Host "`n🔧 В Chrome:" -ForegroundColor Yellow
Write-Host "1. Нажмите F12 для открытия консоли разработчика" -ForegroundColor White
Write-Host "2. Щелкните правой кнопкой по кнопке обновления" -ForegroundColor White
Write-Host "3. Выберите 'Очистить кэш и жесткая перезагрузка'" -ForegroundColor White
Write-Host "4. Или используйте Ctrl+Shift+R для жесткой перезагрузки" -ForegroundColor White

Write-Host "`n🍪 Очистка данных сайта:" -ForegroundColor Yellow
Write-Host "1. Откройте chrome://settings/content/all" -ForegroundColor White
Write-Host "2. Найдите localhost:5000" -ForegroundColor White
Write-Host "3. Нажмите на иконку корзины для удаления данных" -ForegroundColor White

Write-Host "`n⚙️ Дополнительные настройки Chrome:" -ForegroundColor Yellow
Write-Host "1. Откройте chrome://flags/" -ForegroundColor White
Write-Host "2. Найдите 'Hardware-accelerated video decode'" -ForegroundColor White
Write-Host "3. Установите в 'Disabled'" -ForegroundColor White
Write-Host "4. Перезапустите Chrome" -ForegroundColor White

Write-Host "`n🔍 Проверка консоли разработчика:" -ForegroundColor Yellow
Write-Host "1. Откройте F12" -ForegroundColor White
Write-Host "2. Перейдите на вкладку Console" -ForegroundColor White
Write-Host "3. Ищите ошибки (красный текст)" -ForegroundColor White
Write-Host "4. Перейдите на вкладку Network" -ForegroundColor White
Write-Host "5. Обновите страницу и проверьте статус загрузки файлов" -ForegroundColor White

Write-Host "`n✅ Если проблема остается:" -ForegroundColor Green
Write-Host "1. Запустите скрипт clear-chrome-cache.ps1" -ForegroundColor White
Write-Host "2. Переустановите Chrome" -ForegroundColor White
Write-Host "3. Попробуйте другой браузер для сравнения" -ForegroundColor White

Write-Host "`n⏸️ Нажмите любую клавишу для выхода..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
