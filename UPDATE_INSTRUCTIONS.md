# Инструкция по обновлению системы обработки файлов

## Краткое описание

Были исправлены критические ошибки в системе обработки файлов:
1. Проблема с Tesseract OCR
2. Проблема с парсингом JSON
3. Проблема с логированием Python

## Что было исправлено

### 1. Python логирование
- Все логи теперь выводятся в `stderr` вместо `stdout`
- Это позволяет Node.js корректно парсить JSON из Python

### 2. Tesseract OCR
- Добавлена проверка доступности Tesseract
- Система работает даже без Tesseract (с ограничениями на OCR)

### 3. Обработка кодировки
- Автоматическое определение кодировки
- Поддержка русских текстов (CP1251, UTF-8, и др.)

## Как применить изменения

### Вариант 1: Перезапуск сервера (рекомендуется)

```bash
# Остановите сервер
Ctrl+C

# Убедитесь, что все изменения сохранены
git status

# Запустите сервер заново
npm run dev
```

### Вариант 2: Без перезапуска

Если у вас hot-reload, изменения применятся автоматически.

## Проверка работоспособности

1. Откройте консоль браузера
2. Попробуйте загрузить и обработать файл
3. Проверьте, что:
   - Нет ошибок парсинга JSON
   - Файлы обрабатываются корректно
   - Логи видны в консоли сервера (stderr)

## Ожидаемый результат

### До исправлений:
```
Error parsing Python output: SyntaxError: Expected property name or '}' in JSON at position 14
tesseract is not installed or it's not in your PATH
```

### После исправлений:
```
Processing attachments for response 477 from НСС Comp
Successfully processed КП_foto.png: extracted text or appropriate error message
Response: { "response_id": 477, "attachments_processed": 1, ... }
```

## Установка Tesseract (опционально)

Для полной поддержки OCR изображений:

### Windows:
1. Скачайте установщик: https://github.com/UB-Mannheim/tesseract/wiki
2. Установите Tesseract
3. Добавьте в PATH: `C:\Program Files\Tesseract-OCR`
4. Перезапустите терминал/IDE

### Linux/macOS:
```bash
# Linux
sudo apt-get install tesseract-ocr tesseract-ocr-rus

# macOS
brew install tesseract tesseract-lang
```

## Проблемы и решения

### Проблема: JSON все еще не парсится
**Решение:** Убедитесь, что изменения применены в `file_processor.py` и `attachment_analyzer.py`

### Проблема: Логи не видны
**Решение:** Проверьте `file_processing.log` и `attachment_analyzer.log`

### Проблема: OCR не работает
**Решение:** Это нормально, если Tesseract не установлен. Система вернет понятное сообщение об ошибке.

## Дополнительная информация

Подробности см. в `FILE_PROCESSING_FIXES.md`

## Контакты

При возникновении проблем проверьте:
1. Консоль сервера (stderr)
2. Логи: `file_processing.log`, `attachment_analyzer.log`
3. Браузерную консоль

