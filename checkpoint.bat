@echo off
echo.
echo ========================================
echo    🤖 АВТОМАТИЧЕСКИЙ ЧЕКПОИНТ
echo ========================================
echo.

REM Получаем текущую дату и время
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%"
set "timestamp=%YYYY%-%MM%-%DD%_%HH%-%Min%"

echo Введите описание чекпоинта:
echo (например: "Fixed authentication errors" или "Working email system")
set /p desc=

echo.
echo Создаем чекпоинт...
echo.

REM Добавляем все файлы
git add .

REM Создаем коммит с описанием
git commit -m "CHECKPOINT: %timestamp% - %desc%"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Чекпоинт успешно создан!
    echo 📅 Время: %timestamp%
    echo 📝 Описание: %desc%
    echo.
    echo Хотите отправить на GitHub? (y/n)
    set /p push=
    if /i "%push%"=="y" (
        echo Отправляем на GitHub...
        git push
        if %errorlevel% equ 0 (
            echo ✅ Чекпоинт отправлен на GitHub!
        ) else (
            echo ❌ Ошибка при отправке на GitHub
        )
    )
) else (
    echo ❌ Ошибка при создании чекпоинта
)

echo.
echo Нажмите любую клавишу для выхода...
pause >nul
