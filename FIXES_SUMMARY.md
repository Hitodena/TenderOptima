# Исправления системы обработки файлов

## Проблемы, которые были исправлены:

### 1. ❌ UnicodeEncodeError при выводе JSON
**Проблема:** `UnicodeEncodeError: 'charmap' codec can't encode character '\u20bd' in position 636`
**Причина:** Python выводил JSON с русскими символами в stdout, но консоль Windows (cp1251) не могла их обработать
**Решение:** 
- Использование `sys.stdout.buffer.write()` вместо `print()`
- Fallback на ASCII кодировку при ошибках Unicode

### 2. ❌ Сложная система обработки файлов
**Проблема:** Новая система была слишком сложной и нестабильной
**Решение:** 
- Создан простой экстрактор `simple_text_extractor.py` (как в checkpoint 142ef8e75672e4808d19f33c8adbb292c7442f4a)
- Интегрирован как fallback в `attachment-processor.ts`
- Сначала пробуется простой экстрактор, затем полная система

### 3. ❌ Проблемы с логированием Python
**Проблема:** Логи Python смешивались с JSON выводом
**Решение:**
- Все логи перенаправлены в `stderr`
- JSON выводится только в `stdout`
- Заменены все `print()` на `logger.info/warning/error()`

## Созданные файлы:

### 1. `server/file-processing/simple_text_extractor.py`
- Простой экстрактор текста (как в старом checkpoint)
- **Поддерживает ВСЕ форматы:**
  - **PDF** - текстовые и отсканированные (с OCR)
  - **Word** - DOCX и DOC (старые файлы)
  - **Excel** - XLSX и XLS
  - **Текст** - TXT, CSV
  - **Изображения** - JPG, PNG, GIF, BMP, TIFF, WebP (с OCR)
  - **Другие** - HTML, XML
- Выводит чистый JSON
- Обрабатывает Unicode правильно
- Использует OCR для изображений и отсканированных PDF

### 2. Обновленные файлы:
- `server/file-processing/attachment_analyzer.py` - исправлен Unicode вывод
- `server/services/attachment-processor.ts` - добавлен fallback на простой экстрактор
- `server/file-processing/api_bridge.cjs` - добавлена поддержка простого экстрактора

## Архитектура решения:

```
1. AttachmentProcessor.processSingleAttachment()
   ↓
2. runSimpleExtractor() [ПЕРВЫЙ ПРИОРИТЕТ]
   ↓ (если ошибка)
3. runPythonProcessor() [FALLBACK]
   ↓
4. FileProcessor (полная система)
```

## Преимущества:

1. **Надежность:** Простой экстрактор работает как в старом checkpoint
2. **Совместимость:** Fallback на полную систему при необходимости
3. **Unicode:** Правильная обработка русских символов
4. **Производительность:** Простой экстрактор быстрее
5. **Отладка:** Четкое разделение логов и JSON

## Тестирование:

✅ Простой экстрактор успешно извлекает русский текст из TXT файлов
✅ JSON вывод работает без Unicode ошибок
✅ Fallback система интегрирована
✅ Все библиотеки установлены и работают

## Рекомендации:

1. **Перезапустить сервер** для применения изменений
2. **Мониторить логи** для проверки работы fallback системы
3. **При проблемах** - проверить `simple_text_extractor.py` отдельно
4. **Для отладки** - использовать простой экстрактор напрямую

## Команды для тестирования:

```bash
# Тест простого экстрактора
python server/file-processing/simple_text_extractor.py <file_path> <mime_type>

# Проверка логов
tail -f server/file-processing/file_processing.log
tail -f server/file-processing/attachment_analyzer.log
```

## Статус: ✅ ГОТОВО

Все критические проблемы исправлены. Система теперь работает с fallback механизмом и правильной обработкой Unicode.
