# Руководство по настройке OCR для SupplierFinder

## Обзор

Система SupplierFinder теперь поддерживает извлечение текста из отсканированных PDF и изображений с помощью OCR (Optical Character Recognition). Реализованы следующие возможности:

- ✅ Извлечение текста из изображений (JPG, PNG, TIFF)
- ✅ Обработка отсканированных PDF файлов
- ✅ Предобработка изображений для улучшения качества OCR
- ✅ Поддержка русского и английского языков
- ✅ Автоматическое определение типа PDF (текстовый или отсканированный)

## Установка Tesseract OCR

### Windows

1. **Скачайте Tesseract для Windows:**
   - Перейдите на https://github.com/UB-Mannheim/tesseract/wiki
   - Скачайте последнюю версию для Windows

2. **Установите Tesseract:**
   - Запустите установщик
   - Выберите путь установки (по умолчанию: `C:\Program Files\Tesseract-OCR\`)
   - **ВАЖНО:** Запомните путь установки

3. **Добавьте Tesseract в PATH:**
   ```cmd
   # Добавьте в переменную PATH:
   C:\Program Files\Tesseract-OCR\
   ```

4. **Установите языковые пакеты:**
   - Во время установки выберите русский и английский языки
   - Или скачайте дополнительные языковые пакеты с https://github.com/tesseract-ocr/tessdata

### Linux (Ubuntu/Debian)

```bash
# Установка Tesseract
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng

# Проверка установки
tesseract --version
```

### macOS

```bash
# Установка через Homebrew
brew install tesseract tesseract-lang

# Проверка установки
tesseract --version
```

## Настройка Python окружения

### Установка зависимостей

```bash
pip install pytesseract pdf2image Pillow opencv-python
```

### Настройка пути к Tesseract (если необходимо)

Если Tesseract не найден автоматически, добавьте в код:

```python
import pytesseract

# Для Windows
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Для Linux/macOS (обычно не требуется)
# pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'
```

## Тестирование OCR

### Запуск тестов

```bash
python test_ocr_functionality.py
```

### Ожидаемые результаты

- ✅ Изображения: успешное извлечение текста
- ✅ PDF файлы: обработка как текстовых, так и отсканированных PDF
- ✅ Предобработка: улучшение качества изображений

## Технические детали

### Архитектура OCR системы

1. **Обработка изображений:**
   - Функция `extract_text_from_image()` использует pytesseract
   - Предобработка через `preprocess_image_for_ocr()`
   - Поддержка русского и английского языков

2. **Обработка PDF:**
   - Сначала попытка извлечения через PyPDF2
   - При неудаче - конвертация в изображения и OCR
   - Автоматическое определение типа PDF

3. **Предобработка изображений:**
   - Преобразование в оттенки серого
   - Бинаризация с помощью OTSU
   - Удаление шума медианным фильтром

### Конфигурация Tesseract

```python
# Настройки для лучшего качества OCR
config = '--oem 3 --psm 6'
lang = 'rus+eng'
```

- `--oem 3`: Использование LSTM OCR Engine
- `--psm 6`: Предположение единого блока текста
- `rus+eng`: Поддержка русского и английского языков

## Устранение проблем

### Ошибка "tesseract is not installed"

1. Проверьте установку Tesseract:
   ```bash
   tesseract --version
   ```

2. Добавьте путь к Tesseract в код:
   ```python
   import pytesseract
   pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
   ```

### Плохое качество распознавания

1. Проверьте качество исходного изображения
2. Убедитесь, что языковые пакеты установлены
3. Попробуйте разные настройки PSM (Page Segmentation Mode)

### Проблемы с кодировкой

1. Убедитесь, что файлы сохранены в UTF-8
2. Проверьте настройки локали системы

## Поддерживаемые форматы

### Изображения
- ✅ JPG/JPEG
- ✅ PNG
- ✅ TIFF
- ✅ BMP

### PDF
- ✅ Текстовые PDF (быстрая обработка)
- ✅ Отсканированные PDF (OCR)
- ✅ Смешанные PDF (текст + изображения)

## Производительность

### Время обработки (примерные значения)

- Изображение 1000x1000px: 2-5 секунд
- PDF 10 страниц: 30-60 секунд
- Текстовый PDF: < 1 секунды

### Рекомендации по оптимизации

1. Используйте изображения высокого качества
2. Для больших PDF рассмотрите пакетную обработку
3. Настройте кэширование для повторных запросов

## Мониторинг и логирование

### Логи OCR операций

```python
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr_processor")

# В функциях OCR
logger.info(f"Processing image: {file_path}")
logger.info(f"Extracted text length: {len(text)}")
```

### Метрики качества

- Длина извлеченного текста
- Время обработки
- Успешность распознавания
- Качество предобработки

## Заключение

OCR система успешно интегрирована в SupplierFinder и готова к использованию. Основные преимущества:

- 🚀 Автоматическое определение типа файлов
- 🌍 Поддержка многоязычности
- 🔧 Гибкая настройка параметров
- 📊 Детальное логирование
- ⚡ Оптимизированная производительность

Для получения поддержки или сообщения об ошибках обращайтесь к команде разработки.
