# PowerShell скрипт для автоматического создания чекпоинтов
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    🤖 АВТОМАТИЧЕСКИЙ ЧЕКПОИНТ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Получаем текущую дату и время
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"

Write-Host "Введите описание чекпоинта:" -ForegroundColor Yellow
Write-Host "(например: 'Fixed authentication errors' или 'Working email system')" -ForegroundColor Gray
$desc = Read-Host

Write-Host ""
Write-Host "Создаем чекпоинт..." -ForegroundColor Green
Write-Host ""

try {
    # Добавляем все файлы
    git add .
    
    # Создаем коммит с описанием
    $commitMessage = "CHECKPOINT: $timestamp - $desc"
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Чекпоинт успешно создан!" -ForegroundColor Green
        Write-Host "📅 Время: $timestamp" -ForegroundColor Cyan
        Write-Host "📝 Описание: $desc" -ForegroundColor Cyan
        Write-Host ""
        
        $push = Read-Host "Хотите отправить на GitHub? (y/n)"
        if ($push -eq "y" -or $push -eq "Y") {
            Write-Host "Отправляем на GitHub..." -ForegroundColor Yellow
            git push
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Чекпоинт отправлен на GitHub!" -ForegroundColor Green
            } else {
                Write-Host "❌ Ошибка при отправке на GitHub" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "❌ Ошибка при создании чекпоинта" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Нажмите любую клавишу для выхода..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
