#!/usr/bin/env python3
"""
Тестовый скрипт для проверки работы поиска поставщиков
"""
import requests
import json
import time

def test_fastapi_server():
    """Тестируем FastAPI сервер"""
    base_url = "http://localhost:8080"
    
    print("🧪 Testing FastAPI Server")
    print("=" * 50)
    
    # Ждем немного, чтобы сервер запустился
    print("⏳ Waiting for server to start...")
    time.sleep(3)
    
    # Тест 1: Проверка здоровья сервера
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health check passed")
            health_data = response.json()
            print(f"   Google API configured: {health_data.get('google_api_configured', False)}")
            print(f"   Google CSE configured: {health_data.get('google_cse_configured', False)}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    # Тест 2: Тестовый поиск
    try:
        print("\n🔍 Testing search functionality...")
        search_data = {
            "query": "поставщики металла",
            "elements": 5,
            "user_id": "test_user",
            "region": "ru"
        }
        
        print(f"   Search query: '{search_data['query']}'")
        print(f"   Max results: {search_data['elements']}")
        print(f"   Region: {search_data['region']}")
        
        response = requests.post(
            f"{base_url}/search",
            json=search_data,
            timeout=60  # Увеличиваем таймаут для поиска
        )
        
        if response.status_code == 200:
            result = response.json()
            suppliers = result.get("results", [])
            print(f"✅ Search completed successfully!")
            print(f"   Found {len(suppliers)} suppliers")
            
            # Показываем первые несколько результатов
            for i, supplier in enumerate(suppliers[:3], 1):
                print(f"   {i}. {supplier.get('domain', 'N/A')}")
                print(f"      Emails: {len(supplier.get('emails', []))}")
                print(f"      Phones: {len(supplier.get('phones', []))}")
                print(f"      Description: {supplier.get('description', 'N/A')[:100]}...")
                print()
            
            return True
        else:
            print(f"❌ Search failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Search error: {e}")
        return False

if __name__ == "__main__":
    success = test_fastapi_server()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 All tests passed! Parser is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the issues above.")
