#!/usr/bin/env python3
"""
OCR для сканированных PDF с использованием EasyOCR
"""

import PyPDF2
from pdf2image import convert_from_path
import easyocr
import io
import sys
import json
import os

# Инициализируем EasyOCR ридер
# Модели будут скачаны при первом запуске
reader = easyocr.Reader(['ru', 'en'])

def extract_text_from_scanned_pdf(pdf_path):
    """
    Извлекает текст из PDF. Сначала пытается извлечь текстовый слой.
    Если текста нет, использует OCR (EasyOCR).
    """
    
    # --- Шаг 1: Попытка извлечь встроенный текст ---
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            # Если текст успешно извлечен, возвращаем его
            if len(text.strip()) > 100: # Простая проверка, что текст не пустой
                print(f"INFO: Извлечен текстовый слой из {pdf_path}", file=sys.stderr)
                return text.strip()
    except Exception as e:
        print(f"WARNING: Не удалось прочитать {pdf_path} с помощью PyPDF2: {e}. Переключаюсь на OCR.", file=sys.stderr)

    # --- Шаг 2: Если текста нет, запускаем OCR ---
    print(f"INFO: Текстовый слой не найден в {pdf_path}. Запускаю OCR...", file=sys.stderr)
    
    try:
        # Конвертируем PDF в список изображений
        images = convert_from_path(pdf_path)
        full_text_ocr = ""

        # Обрабатываем каждую страницу
        for i, image in enumerate(images):
            # EasyOCR может работать напрямую с объектом изображения Pillow
            result = reader.readtext(image, detail=0, paragraph=True)
            full_text_ocr += " ".join(result) + "\n\n--- Page {} ---\n\n".format(i+1)
        
        print(f"INFO: OCR завершен для {pdf_path}", file=sys.stderr)
        return full_text_ocr.strip()

    except Exception as e:
        return f"ERROR: Не удалось обработать файл {pdf_path} с помощью OCR. Ошибка: {e}"

def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        result = {
            "error": "Usage: python ocr_pdf_extractor.py <pdf_path>",
            "success": False
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        result = {
            "error": f"File not found: {pdf_path}",
            "success": False
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    try:
        # Извлекаем текст
        extracted_text = extract_text_from_scanned_pdf(pdf_path)
        
        # Возвращаем результат в JSON формате
        result = {
            "success": True,
            "text": extracted_text,
            "text_length": len(extracted_text),
            "file_type": "application/pdf",
            "filename": os.path.basename(pdf_path),
            "method": "ocr_pdf_extractor"
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        result = {
            "error": f"Error processing PDF: {e}",
            "success": False
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
