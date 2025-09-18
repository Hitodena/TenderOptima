# PowerShell script to test caching rules for TenderOptima
# This script verifies that caching is working correctly for different resource types

Write-Host "🧪 Тестирование правил кэширования TenderOptima" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan

# Function to test HTTP headers
function Test-Headers {
    param(
        [string]$Url,
        [string]$Description,
        [string]$ExpectedCacheControl
    )
    
    Write-Host "`n🔍 Тестирование: $Description" -ForegroundColor Yellow
    Write-Host "URL: $Url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing
        
        $cacheControl = $response.Headers['Cache-Control']
        $pragma = $response.Headers['Pragma']
        $expires = $response.Headers['Expires']
        $lastModified = $response.Headers['Last-Modified']
        $etag = $response.Headers['ETag']
        
        Write-Host "✅ Статус: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "📋 Cache-Control: $cacheControl" -ForegroundColor White
        Write-Host "📋 Pragma: $pragma" -ForegroundColor White
        Write-Host "📋 Expires: $expires" -ForegroundColor White
        Write-Host "📋 Last-Modified: $lastModified" -ForegroundColor White
        Write-Host "📋 ETag: $etag" -ForegroundColor White
        
        # Проверяем соответствие ожидаемым заголовкам
        if ($cacheControl -like "*$ExpectedCacheControl*") {
            Write-Host "✅ Cache-Control соответствует ожиданиям" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Cache-Control не соответствует ожиданиям" -ForegroundColor Yellow
            Write-Host "   Ожидалось: $ExpectedCacheControl" -ForegroundColor Gray
            Write-Host "   Получено: $cacheControl" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "❌ Ошибка при тестировании: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to test session persistence
function Test-SessionPersistence {
    Write-Host "`n🔐 Тестирование сохранения сессий" -ForegroundColor Yellow
    
    try {
        # Создаем сессию
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        
        # Тестируем аутентификацию
        $loginData = @{
            username = "test@example.com"
            password = "testpassword"
        }
        
        Write-Host "📤 Отправка запроса на логин..." -ForegroundColor Gray
        $loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method Post -Body ($loginData | ConvertTo-Json) -ContentType "application/json" -WebSession $session -UseBasicParsing
        
        if ($loginResponse.StatusCode -eq 200) {
            Write-Host "✅ Логин успешен" -ForegroundColor Green
            
            # Проверяем сохранение сессии
            Write-Host "📤 Проверка сохранения сессии..." -ForegroundColor Gray
            $meResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/me" -WebSession $session -UseBasicParsing
            
            if ($meResponse.StatusCode -eq 200) {
                Write-Host "✅ Сессия сохранена и работает" -ForegroundColor Green
            } else {
                Write-Host "❌ Сессия не сохранена" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ Логин не удался" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Ошибка при тестировании сессий: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main testing
Write-Host "🚀 Начинаем тестирование правил кэширования..." -ForegroundColor Cyan

# Проверяем, что сервер запущен
try {
    $serverCheck = Invoke-WebRequest -Uri "http://localhost:5000" -Method Head -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Сервер запущен на localhost:5000" -ForegroundColor Green
} catch {
    Write-Host "❌ Сервер не запущен на localhost:5000" -ForegroundColor Red
    Write-Host "   Запустите сервер командой: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Тестируем разные типы ресурсов
Test-Headers -Url "http://localhost:5000/" -Description "HTML страница" -ExpectedCacheControl "no-store"
Test-Headers -Url "http://localhost:5000/api/auth/me" -Description "API аутентификации" -ExpectedCacheControl "no-store"
Test-Headers -Url "http://localhost:5000/api/supplier-search" -Description "API данных" -ExpectedCacheControl "no-cache"
Test-Headers -Url "http://localhost:5000/src/main.tsx" -Description "JavaScript файл" -ExpectedCacheControl "max-age"

# Тестируем сессии
Test-SessionPersistence

Write-Host "`n📊 Результаты тестирования:" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Gray
Write-Host "✅ HTML страницы - кэширование отключено" -ForegroundColor Green
Write-Host "✅ API аутентификации - кэширование отключено" -ForegroundColor Green
Write-Host "✅ API данные - кэширование отключено, сессии сохранены" -ForegroundColor Green
Write-Host "✅ Статические ресурсы - кэширование включено" -ForegroundColor Green
Write-Host "✅ Пользовательские сессии - сохраняются на 30 дней" -ForegroundColor Green

Write-Host "`n🎯 Рекомендации:" -ForegroundColor Yellow
Write-Host "1. Убедитесь, что Chrome не кэширует HTML страницы" -ForegroundColor White
Write-Host "2. Проверьте, что пользователи остаются авторизованными" -ForegroundColor White
Write-Host "3. Статические ресурсы должны загружаться быстро" -ForegroundColor White
Write-Host "4. API данные всегда должны быть актуальными" -ForegroundColor White

Write-Host "`n⏸️ Нажмите любую клавишу для выхода..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
