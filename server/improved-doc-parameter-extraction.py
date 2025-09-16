#!/usr/bin/env python3
"""
Улучшенный алгоритм извлечения параметров из DOC файлов
"""

import re
import sys

def extract_parameters_from_doc_text(text):
    """
    Извлекает параметры из сырого текста DOC файла
    """
    if not text:
        return {}
    
    # Более агрессивная очистка текста
    # Убираем служебные символы и оставляем только читаемый текст
    cleaned_text = re.sub(r'[^\w\s\.,!?;:()\-+=\d%а-яА-Я]', ' ', text)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
    
    # Ищем читаемые слова (минимум 3 символа)
    words = re.findall(r'\b\w{3,}\b', cleaned_text)
    readable_text = ' '.join(words)
    
    parameters = {}
    
    # 1. Поиск цен
    price_patterns = [
        r'(\d+[\s\d]*(?:[.,]\d+)?)\s*(?:бел\.?\s*руб|руб|р\.?|₽)',
        r'цена[:\s]+(\d+[\s\d]*(?:[.,]\d+)?)',
        r'стоимость[:\s]+(\d+[\s\d]*(?:[.,]\d+)?)',
        r'(\d+[\s\d]*(?:[.,]\d+)?)\s*(?:за\s+1000|за\s+единицу)',
    ]
    
    for pattern in price_patterns:
        matches = re.findall(pattern, readable_text, re.IGNORECASE)
        if matches:
            # Берем первое найденное значение
            price = matches[0].replace(' ', '').replace(',', '.')
            if price.replace('.', '').isdigit():
                parameters['price'] = price
                break
    
    # 2. Поиск общих сумм
    total_patterns = [
        r'общая\s+стоимость[:\s]+(\d+[\s\d]*(?:[.,]\d+)?)',
        r'итого[:\s]+(\d+[\s\d]*(?:[.,]\d+)?)',
        r'сумма[:\s]+(\d+[\s\d]*(?:[.,]\d+)?)',
    ]
    
    for pattern in total_patterns:
        matches = re.findall(pattern, readable_text, re.IGNORECASE)
        if matches:
            total = matches[0].replace(' ', '').replace(',', '.')
            if total.replace('.', '').isdigit():
                parameters['total_cost'] = total
                break
    
    # 3. Поиск сроков поставки
    delivery_patterns = [
        r'срок[и]?\s+поставки[:\s]+([^.!?]+)',
        r'доставка[:\s]+([^.!?]+)',
        r'(\d+)\s*(?:календарных\s+)?дн[еяй]',
        r'(\d+)\s*(?:рабочих\s+)?дн[еяй]',
    ]
    
    for pattern in delivery_patterns:
        matches = re.findall(pattern, readable_text, re.IGNORECASE)
        if matches:
            delivery = matches[0].strip()
            if len(delivery) > 3:  # Минимальная длина для осмысленного текста
                parameters['delivery_terms'] = delivery
                break
    
    # 4. Поиск условий оплаты
    payment_patterns = [
        r'условия\s+расчета[:\s]+([^.!?]+)',
        r'условия\s+оплаты[:\s]+([^.!?]+)',
        r'оплата[:\s]+([^.!?]+)',
        r'(\d+%)\s*(?:предоплата|предоплату)',
        r'(100%)\s*(?:предоплата|предоплату)',
    ]
    
    for pattern in payment_patterns:
        matches = re.findall(pattern, readable_text, re.IGNORECASE)
        if matches:
            payment = matches[0].strip()
            if len(payment) > 2:
                parameters['payment_terms'] = payment
                break
    
    # 5. Поиск описания товара
    product_patterns = [
        r'этикетка[:\s]+([^.!?]+)',
        r'изготовление[:\s]+([^.!?]+)',
        r'товар[:\s]+([^.!?]+)',
        r'продукт[:\s]+([^.!?]+)',
    ]
    
    for pattern in product_patterns:
        matches = re.findall(pattern, readable_text, re.IGNORECASE)
        if matches:
            product = matches[0].strip()
            if len(product) > 5:
                parameters['product_description'] = product
                break
    
    # 6. Поиск количества
    quantity_patterns = [
        r'тираж[:\s]+(\d+[\s\d]*)',
        r'количество[:\s]+(\d+[\s\d]*)',
        r'(\d+[\s\d]*)\s*(?:шт|штук|единиц)',
    ]
    
    for pattern in quantity_patterns:
        matches = re.findall(pattern, readable_text, re.IGNORECASE)
        if matches:
            quantity = matches[0].replace(' ', '')
            if quantity.isdigit():
                parameters['quantity'] = quantity
                break
    
    return parameters

def test_extraction(text):
    """
    Тестирует извлечение параметров из текста
    """
    print("Testing parameter extraction from DOC text...")
    print(f"Text length: {len(text)} characters")
    
    # Безопасный preview текста
    try:
        preview = text[:300].encode('ascii', errors='ignore').decode('ascii')
        print(f"Text preview: {preview}...")
    except:
        print("Text preview: [Binary content]")
    print()
    
    parameters = extract_parameters_from_doc_text(text)
    
    print("Extracted parameters:")
    for key, value in parameters.items():
        print(f"  {key}: {value}")
    
    if not parameters:
        print("  No parameters found")
    
    return parameters

def main():
    if len(sys.argv) != 2:
        print("Usage: python improved-doc-parameter-extraction.py <text_file>")
        sys.exit(1)
    
    text_file = sys.argv[1]
    
    try:
        with open(text_file, 'r', encoding='utf-8', errors='ignore') as f:
            text = f.read()
    except:
        try:
            with open(text_file, 'r', encoding='cp1251', errors='ignore') as f:
                text = f.read()
        except:
            print(f"ERROR: Cannot read file {text_file}")
            sys.exit(1)
    
    test_extraction(text)

if __name__ == "__main__":
    main()
