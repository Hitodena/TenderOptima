# PowerShell script to restore virtual environment
Write-Host "🔧 Восстановление виртуального окружения..." -ForegroundColor Green

# Step 1: Remove old .venv if exists
if (Test-Path ".venv") {
    Write-Host "🗑️ Удаление старого виртуального окружения..." -ForegroundColor Yellow
    try {
        Remove-Item -Recurse -Force .venv -ErrorAction Stop
        Write-Host "✅ Старое окружение удалено" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Не удалось удалить .venv, попробуем создать новое с другим именем" -ForegroundColor Yellow
        $venvName = ".venv-new"
    }
} else {
    Write-Host "✅ Старое окружение не найдено" -ForegroundColor Green
    $venvName = ".venv"
}

# Step 2: Create new virtual environment
Write-Host "📦 Создание нового виртуального окружения..." -ForegroundColor Cyan
python -m venv $venvName

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Виртуальное окружение создано: $venvName" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка создания виртуального окружения" -ForegroundColor Red
    exit 1
}

# Step 3: Activate virtual environment
Write-Host "🚀 Активация виртуального окружения..." -ForegroundColor Cyan
& "$venvName\Scripts\Activate.ps1"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Виртуальное окружение активировано" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка активации виртуального окружения" -ForegroundColor Red
    exit 1
}

# Step 4: Upgrade pip
Write-Host "⬆️ Обновление pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# Step 5: Install dependencies
Write-Host "📚 Установка зависимостей..." -ForegroundColor Cyan
pip install -r parsers/requirements.txt

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Зависимости установлены" -ForegroundColor Green
} else {
    Write-Host "❌ Ошибка установки зависимостей" -ForegroundColor Red
    exit 1
}

# Step 6: Test Python server
Write-Host "🧪 Тестирование Python сервера..." -ForegroundColor Cyan
Write-Host "Запуск: python start-python-server.py" -ForegroundColor Yellow
Write-Host "Для остановки нажмите Ctrl+C" -ForegroundColor Yellow

# Start Python server
python start-python-server.py
