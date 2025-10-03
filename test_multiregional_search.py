#!/usr/bin/env python3
"""
Тестирование мультирегионального поиска с интеллектуальной модификацией запросов
"""

import asyncio
import os
from pathlib import Path
from parsers.search_manager import main_search

# Настройки для тестирования
TEST_QUERY = "купить стулья, стулья от производителя"
TEST_USER_ID = "test_user_123"
TEST_ELEMENTS = 5  # Малое количество для быстрого тестирования

# Настройки источников поиска
SOURCES = {
    "google": True,
    "yandex": True
}

# API ключи (замените на реальные для тестирования)
GOOGLE_API = os.getenv("GOOGLE_SEARCH_API_TOKEN", "your_google_api_key")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", "your_google_cse_id")
YANDEX_KEY_FILE = Path(os.getenv("YANDEX_KEY_PATH", "parsers/yand_keygud.json"))
YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "your_yandex_folder_id")


async def test_single_country():
    """Тест 1: Один регион-страна"""
    print("\n" + "="*60)
    print("ТЕСТ 1: Один регион-страна (Беларусь)")
    print("="*60)
    
    regions = [
        {
            "name": "Беларусь", 
            "type": "country", 
            "yandexId": 149,
            "googleCode": "by"
        }
    ]
    
    print(f"Запрос: '{TEST_QUERY}'")
    print(f"Регионы: {regions}")
    print(f"Ожидаемое поведение: Запрос НЕ должен модифицироваться (страна)")
    
    try:
        results = await main_search(
            query=TEST_QUERY,
            user_id=TEST_USER_ID,
            elements=TEST_ELEMENTS,
            regions=regions,
            sources=SOURCES,
            google_search_api=GOOGLE_API,
            google_search_id=GOOGLE_CSE_ID,
            yandex_key_file=YANDEX_KEY_FILE,
            yandex_folder_id=YANDEX_FOLDER_ID
        )
        
        print(f"\nРезультат: Найдено {len(results)} поставщиков")
        for i, result in enumerate(results[:3], 1):  # Показываем первые 3
            print(f"  {i}. {result.get('domain', 'N/A')} - {result.get('description', 'N/A')[:50]}...")
            
    except Exception as e:
        print(f"Ошибка: {e}")


async def test_single_city():
    """Тест 2: Один регион-город"""
    print("\n" + "="*60)
    print("ТЕСТ 2: Один регион-город (Минск)")
    print("="*60)
    
    regions = [
        {
            "name": "Минск", 
            "type": "city", 
            "yandexId": 157,
            "googleCode": "by"
        }
    ]
    
    print(f"Запрос: '{TEST_QUERY}'")
    print(f"Регионы: {regions}")
    print(f"Ожидаемое поведение: Запрос должен модифицироваться - добавить 'Минск' к каждому подзапросу")
    print(f"Ожидаемый модифицированный запрос: 'купить стулья Минск, стулья от производителя Минск'")
    
    try:
        results = await main_search(
            query=TEST_QUERY,
            user_id=TEST_USER_ID,
            elements=TEST_ELEMENTS,
            regions=regions,
            sources=SOURCES,
            google_search_api=GOOGLE_API,
            google_search_id=GOOGLE_CSE_ID,
            yandex_key_file=YANDEX_KEY_FILE,
            yandex_folder_id=YANDEX_FOLDER_ID
        )
        
        print(f"\nРезультат: Найдено {len(results)} поставщиков")
        for i, result in enumerate(results[:3], 1):  # Показываем первые 3
            print(f"  {i}. {result.get('domain', 'N/A')} - {result.get('description', 'N/A')[:50]}...")
            
    except Exception as e:
        print(f"Ошибка: {e}")


async def test_multiple_regions():
    """Тест 3: Несколько регионов"""
    print("\n" + "="*60)
    print("ТЕСТ 3: Несколько регионов (Беларусь + Казань)")
    print("="*60)
    
    regions = [
        {
            "name": "Беларусь", 
            "type": "country", 
            "yandexId": 149,
            "googleCode": "by"
        },
        {
            "name": "Казань", 
            "type": "city", 
            "yandexId": 43,
            "googleCode": "ru"
        }
    ]
    
    print(f"Запрос: '{TEST_QUERY}'")
    print(f"Регионы: {regions}")
    print(f"Ожидаемое поведение:")
    print(f"  - Для Беларуси: запрос НЕ модифицируется (страна)")
    print(f"  - Для Казани: запрос модифицируется - добавить 'Казань' к каждому подзапросу")
    print(f"  - Ожидаемый модифицированный запрос для Казани: 'купить стулья Казань, стулья от производителя Казань'")
    
    try:
        results = await main_search(
            query=TEST_QUERY,
            user_id=TEST_USER_ID,
            elements=TEST_ELEMENTS,
            regions=regions,
            sources=SOURCES,
            google_search_api=GOOGLE_API,
            google_search_id=GOOGLE_CSE_ID,
            yandex_key_file=YANDEX_KEY_FILE,
            yandex_folder_id=YANDEX_FOLDER_ID
        )
        
        print(f"\nРезультат: Найдено {len(results)} поставщиков")
        for i, result in enumerate(results[:5], 1):  # Показываем первые 5
            print(f"  {i}. {result.get('domain', 'N/A')} - {result.get('description', 'N/A')[:50]}...")
            
    except Exception as e:
        print(f"Ошибка: {e}")


async def test_no_regions():
    """Тест 4: Без регионов (должен использовать дефолт)"""
    print("\n" + "="*60)
    print("ТЕСТ 4: Без регионов (должен использовать дефолт - Россия)")
    print("="*60)
    
    regions = []  # Пустой список
    
    print(f"Запрос: '{TEST_QUERY}'")
    print(f"Регионы: {regions} (пустой список)")
    print(f"Ожидаемое поведение: Должен использовать дефолтный регион (Россия), запрос НЕ модифицируется")
    
    try:
        results = await main_search(
            query=TEST_QUERY,
            user_id=TEST_USER_ID,
            elements=TEST_ELEMENTS,
            regions=regions,
            sources=SOURCES,
            google_search_api=GOOGLE_API,
            google_search_id=GOOGLE_CSE_ID,
            yandex_key_file=YANDEX_KEY_FILE,
            yandex_folder_id=YANDEX_FOLDER_ID
        )
        
        print(f"\nРезультат: Найдено {len(results)} поставщиков")
        for i, result in enumerate(results[:3], 1):  # Показываем первые 3
            print(f"  {i}. {result.get('domain', 'N/A')} - {result.get('description', 'N/A')[:50]}...")
            
    except Exception as e:
        print(f"Ошибка: {e}")


async def main():
    """Запуск всех тестов"""
    print("🚀 ЗАПУСК ТЕСТИРОВАНИЯ МУЛЬТИРЕГИОНАЛЬНОГО ПОИСКА")
    print("="*60)
    print(f"Тестовый запрос: '{TEST_QUERY}'")
    print(f"Количество элементов на регион: {TEST_ELEMENTS}")
    print(f"Источники поиска: {SOURCES}")
    print(f"Пользователь: {TEST_USER_ID}")
    
    # Проверяем наличие API ключей
    print(f"\nПроверка API ключей:")
    print(f"  Google API: {'✅ Настроен' if GOOGLE_API != 'your_google_api_key' else '❌ Не настроен'}")
    print(f"  Google CSE ID: {'✅ Настроен' if GOOGLE_CSE_ID != 'your_google_cse_id' else '❌ Не настроен'}")
    print(f"  Yandex Key File: {'✅ Настроен' if YANDEX_KEY_FILE.exists() else '❌ Не найден'}")
    print(f"  Yandex Folder ID: {'✅ Настроен' if YANDEX_FOLDER_ID != 'your_yandex_folder_id' else '❌ Не настроен'}")
    
    if GOOGLE_API == 'your_google_api_key' or GOOGLE_CSE_ID == 'your_google_cse_id':
        print("\n⚠️  ВНИМАНИЕ: API ключи не настроены. Тесты будут выполняться с заглушками.")
        print("   Для реального тестирования настройте переменные окружения:")
        print("   - GOOGLE_SEARCH_API_TOKEN")
        print("   - GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
        print("   - YANDEX_KEY_PATH")
        print("   - YANDEX_FOLDER_ID")
    
    # Запускаем тесты
    await test_single_country()
    await test_single_city()
    await test_multiple_regions()
    await test_no_regions()
    
    print("\n" + "="*60)
    print("✅ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО")
    print("="*60)
    print("\nПроверьте логи в файле SearchManager.log для детального анализа:")
    print("- Оригинальные и модифицированные запросы")
    print("- Типы регионов и их обработка")
    print("- Количество результатов по каждому региону")
    print("- Процесс дедупликации")


if __name__ == "__main__":
    asyncio.run(main())
