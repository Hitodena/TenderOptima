@echo off
REM Быстрый чекпоинт без интерактивного ввода
REM Использование: quick-checkpoint.bat "Описание чекпоинта"

if "%1"=="" (
    echo Использование: quick-checkpoint.bat "Описание чекпоинта"
    echo Пример: quick-checkpoint.bat "Fixed authentication errors"
    pause
    exit /b 1
)

REM Получаем текущую дату и время
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%"
set "timestamp=%YYYY%-%MM%-%DD%_%HH%-%Min%"

echo Создаем быстрый чекпоинт: %1

git add .
git commit -m "CHECKPOINT: %timestamp% - %1"

if %errorlevel% equ 0 (
    echo ✅ Чекпоинт создан: %1
) else (
    echo ❌ Ошибка при создании чекпоинта
)
