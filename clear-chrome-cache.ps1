# PowerShell script to clear Chrome cache and fix display issues
# Run this script as Administrator if needed

Write-Host "🧹 Очистка кэша Chrome для исправления проблем с отображением..." -ForegroundColor Green

# Function to close Chrome processes
function Close-ChromeProcesses {
    Write-Host "🔄 Закрытие всех процессов Chrome..." -ForegroundColor Yellow
    try {
        Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 2
        Write-Host "✅ Chrome процессы закрыты" -ForegroundColor Green
    } catch {
        Write-Host "ℹ️ Chrome процессы не найдены или уже закрыты" -ForegroundColor Blue
    }
}

# Function to clear Chrome cache
function Clear-ChromeCache {
    Write-Host "🗑️ Очистка кэша Chrome..." -ForegroundColor Yellow
    
    $chromePaths = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\GPUCache",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Service Worker\CacheStorage",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\IndexedDB",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Storage",
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Session Storage"
    )
    
    foreach ($path in $chromePaths) {
        if (Test-Path $path) {
            try {
                Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "✅ Очищен: $path" -ForegroundColor Green
            } catch {
                Write-Host "⚠️ Не удалось очистить: $path" -ForegroundColor Yellow
            }
        }
    }
}

# Function to clear Chrome cookies for localhost
function Clear-LocalhostCookies {
    Write-Host "🍪 Очистка cookies для localhost..." -ForegroundColor Yellow
    
    $cookiesPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cookies"
    if (Test-Path $cookiesPath) {
        try {
            # Create a backup
            Copy-Item $cookiesPath "$cookiesPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')" -ErrorAction SilentlyContinue
            
            # Note: Direct cookie manipulation is complex, so we'll just inform the user
            Write-Host "ℹ️ Для полной очистки cookies откройте Chrome и перейдите в Настройки > Конфиденциальность > Очистить данные" -ForegroundColor Blue
        } catch {
            Write-Host "⚠️ Не удалось создать резервную копию cookies" -ForegroundColor Yellow
        }
    }
}

# Function to clear Chrome service workers
function Clear-ServiceWorkers {
    Write-Host "⚙️ Очистка Service Workers..." -ForegroundColor Yellow
    
    $swPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Service Worker"
    if (Test-Path $swPath) {
        try {
            Remove-Item -Path $swPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "✅ Service Workers очищены" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Не удалось очистить Service Workers" -ForegroundColor Yellow
        }
    }
}

# Main execution
try {
    Write-Host "🚀 Начинаем очистку кэша Chrome..." -ForegroundColor Cyan
    
    # Close Chrome first
    Close-ChromeProcesses
    
    # Clear various cache types
    Clear-ChromeCache
    Clear-ServiceWorkers
    Clear-LocalhostCookies
    
    Write-Host "`n🎉 Очистка завершена!" -ForegroundColor Green
    Write-Host "📋 Рекомендации:" -ForegroundColor Cyan
    Write-Host "   1. Перезапустите Chrome" -ForegroundColor White
    Write-Host "   2. Откройте localhost:5000 в режиме инкогнито для проверки" -ForegroundColor White
    Write-Host "   3. Если проблема остается, выполните жесткую перезагрузку (Ctrl+Shift+R)" -ForegroundColor White
    Write-Host "   4. Проверьте консоль разработчика (F12) на наличие ошибок" -ForegroundColor White
    
    Write-Host "`n🔧 Дополнительные действия в Chrome:" -ForegroundColor Yellow
    Write-Host "   - Откройте chrome://settings/clearBrowserData" -ForegroundColor White
    Write-Host "   - Выберите 'Все время' и отметьте все пункты" -ForegroundColor White
    Write-Host "   - Нажмите 'Очистить данные'" -ForegroundColor White
    
} catch {
    Write-Host "❌ Ошибка при очистке кэша: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n⏸️ Нажмите любую клавишу для выхода..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
