# Quick start Python server script
Write-Host "🚀 Быстрый запуск Python сервера..." -ForegroundColor Green

# Check if .venv exists
if (Test-Path ".venv") {
    Write-Host "✅ Виртуальное окружение найдено" -ForegroundColor Green
    Write-Host "🚀 Активация виртуального окружения..." -ForegroundColor Cyan
    & ".venv\Scripts\Activate.ps1"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Виртуальное окружение активировано" -ForegroundColor Green
        Write-Host "🧪 Запуск Python сервера..." -ForegroundColor Cyan
        python start-python-server.py
    } else {
        Write-Host "❌ Ошибка активации виртуального окружения" -ForegroundColor Red
        Write-Host "Запустите restore-venv.ps1 для восстановления" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Виртуальное окружение не найдено" -ForegroundColor Red
    Write-Host "Запустите restore-venv.ps1 для создания" -ForegroundColor Yellow
}
