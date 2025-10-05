#!/usr/bin/env python3
import os
import sys
import json
import logging
import re
import tempfile
import shutil
import platform
import subprocess
from datetime import datetime
from typing import Dict, Any
import numpy as np

# --- Библиотеки для форматов ---
import PyPDF2
from pdf2image import convert_from_path
import docx2txt
import pytesseract
from PIL import Image
import cv2
import magic

# --- НАСТРОЙКА ЛОГИРОВАНИЯ ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger('file_processor')

# --- ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ ПУТЕЙ К ВНЕШНИМ ПРОГРАММАМ ---
if platform.system() == "Windows":
    try:
        tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        if os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
            logger.info(f"Установлен путь к Tesseract: {tesseract_path}")
    except Exception as e:
        logger.error(f"Не удалось установить путь к Tesseract: {e}")

SOFFICE_PATH = None
if platform.system() == "Windows":
    standard_path = r'C:\Program Files\LibreOffice\program\soffice.exe'
    if os.path.exists(standard_path):
        SOFFICE_PATH = standard_path
        logger.info(f"Найден исполняемый файл LibreOffice: {SOFFICE_PATH}")

class FileProcessor:
    def __init__(self, output_dir: str = "processed_attachments"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        logger.info(f"FileProcessor инициализирован с директорией: {output_dir}")

    def process_attachment(self, file_data: bytes, filename: str, **kwargs) -> Dict[str, Any]:
        file_ext = os.path.splitext(filename)[1].lower()
        temp_file_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
                temp_file.write(file_data)
                temp_file_path = temp_file.name

            mime_type = magic.from_file(temp_file_path, mime=True)
            logger.info(f"Файл: '{filename}', MIME-тип: {mime_type}")
            extracted_text, processing_method = "", "N/A"

            if 'pdf' in mime_type:
                extracted_text, processing_method = self._process_pdf(temp_file_path), "PDF Processor"
            elif 'msword' in mime_type:
                extracted_text, processing_method = self._process_doc(temp_file_path), "DOC Processor"
            elif 'openxmlformats-officedocument.wordprocessingml' in mime_type:
                extracted_text, processing_method = self._process_docx(temp_file_path), "DOCX Reader"
            elif mime_type.startswith('image/'):
                extracted_text, processing_method = self._process_image_ocr(temp_file_path), "Tesseract OCR"
            else:
                extracted_text, processing_method = self._read_as_text_fallback(temp_file_path), "Fallback Text Read"
            
            if not extracted_text or len(extracted_text.strip()) < 20:
                 logger.warning(f"Метод '{processing_method}' не дал результата. Пробуем OCR как последний шанс.")
                 try:
                    ocr_fallback_text = self._process_image_ocr(temp_file_path, is_fallback=True)
                    if ocr_fallback_text:
                        extracted_text = ocr_fallback_text
                        processing_method += " + OCR Fallback"
                 except Exception:
                    logger.error("Полный провал OCR как последнего шанса.")

            return {"text_content": extracted_text.strip(), "processing_status": {"method": processing_method, "status": "success"}}
        except Exception as e:
            logger.error(f"Критическая ошибка при обработке '{filename}': {e}", exc_info=True)
            return {"text_content": f"Ошибка обработки: {e}", "processing_status": {"method": "Error", "status": "critical_failure", "user_message": str(e)}}
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    def _process_pdf(self, file_path: str) -> str:
        text = ""
        try:
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                if not reader.is_encrypted:
                    for page in reader.pages: text += page.extract_text() or ""
        except Exception: pass
        if len(text.strip()) < 100:
            try:
                images, ocr_text = convert_from_path(file_path), ""
                for img in images: ocr_text += pytesseract.image_to_string(img, lang='rus+eng') + "\n"
                return ocr_text
            except Exception: pass
        return text

    def _process_doc(self, file_path: str) -> str:
        if not SOFFICE_PATH: return ""
        logger.info(f"Конвертация .doc через LibreOffice: {file_path}")
        temp_dir = tempfile.gettempdir()
        try:
            subprocess.run([SOFFICE_PATH, "--headless", "--convert-to", "docx", "--outdir", temp_dir, file_path], check=True, timeout=60, capture_output=True)
            docx_path = os.path.join(temp_dir, os.path.splitext(os.path.basename(file_path))[0] + ".docx")
            if os.path.exists(docx_path):
                text = self._process_docx(docx_path)
                os.remove(docx_path)
                return text
        except Exception as e:
            logger.error(f"Ошибка конвертации LibreOffice: {e}")
        return ""

    def _process_docx(self, file_path: str) -> str:
        try: return docx2txt.process(file_path)
        except Exception: return ""

    def _process_image_ocr(self, file_path: str, is_fallback: bool = False) -> str:
        try:
            image = None
            if file_path.lower().endswith('.pdf') and is_fallback:
                images = convert_from_path(file_path, first_page=1, last_page=1)
                if images: image = images[0]
            else:
                image = Image.open(file_path)
            if image is None: return ""
            gray_image = cv2.cvtColor(np.array(image.convert('RGB')), cv2.COLOR_RGB2GRAY)
            return pytesseract.image_to_string(gray_image, lang='rus+eng')
        except Exception: return ""
    
    def _read_as_text_fallback(self, file_path: str) -> str:
        for encoding in ['utf-8', 'cp1251', 'latin-1']:
            try:
                with open(file_path, 'r', encoding=encoding) as f: return f.read()
            except Exception: continue
        return ""
