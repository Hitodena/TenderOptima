@echo off
echo 🔧 Восстановление виртуального окружения...

REM Step 1: Remove old .venv if exists
if exist ".venv" (
    echo 🗑️ Удаление старого виртуального окружения...
    rmdir /s /q .venv
    if errorlevel 1 (
        echo ⚠️ Не удалось удалить .venv, попробуем создать новое с другим именем
        set VENV_NAME=.venv-new
    ) else (
        echo ✅ Старое окружение удалено
        set VENV_NAME=.venv
    )
) else (
    echo ✅ Старое окружение не найдено
    set VENV_NAME=.venv
)

REM Step 2: Create new virtual environment
echo 📦 Создание нового виртуального окружения...
python -m venv %VENV_NAME%
if errorlevel 1 (
    echo ❌ Ошибка создания виртуального окружения
    pause
    exit /b 1
)
echo ✅ Виртуальное окружение создано: %VENV_NAME%

REM Step 3: Activate virtual environment
echo 🚀 Активация виртуального окружения...
call %VENV_NAME%\Scripts\activate.bat
if errorlevel 1 (
    echo ❌ Ошибка активации виртуального окружения
    pause
    exit /b 1
)
echo ✅ Виртуальное окружение активировано

REM Step 4: Upgrade pip
echo ⬆️ Обновление pip...
python -m pip install --upgrade pip

REM Step 5: Install dependencies
echo 📚 Установка зависимостей...
pip install -r parsers/requirements.txt
if errorlevel 1 (
    echo ❌ Ошибка установки зависимостей
    pause
    exit /b 1
)
echo ✅ Зависимости установлены

REM Step 6: Start Python server
echo 🧪 Запуск Python сервера...
echo Для остановки нажмите Ctrl+C
python start-python-server.py
