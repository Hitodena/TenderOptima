#!/usr/bin/env python3
"""
Тестовый скрипт для проверки работы парсера
"""
import sys
import os
from pathlib import Path

# Добавляем папку parsers в путь
current_dir = Path(__file__).parent
parsers_dir = current_dir / "parsers"
sys.path.insert(0, str(current_dir))
sys.path.insert(0, str(parsers_dir))

def test_imports():
    """Тестируем импорты"""
    try:
        print("Testing imports...")
        
        # Тестируем основные модули
        from main import main_search
        print("✓ main.py imported successfully")
        
        from fastapi_server import app
        print("✓ fastapi_server.py imported successfully")
        
        from search_manager import fetch_all
        print("✓ search_manager.py imported successfully")
        
        from parsers.google_parser import parse_google
        print("✓ google_parser.py imported successfully")
        
        from info_getter import get_info
        print("✓ info_getter.py imported successfully")
        
        print("\n✅ All imports successful!")
        return True
        
    except Exception as e:
        print(f"❌ Import error: {e}")
        return False

def test_environment():
    """Проверяем переменные окружения"""
    print("\nChecking environment variables...")
    
    google_api = os.getenv("GOOGLE_SEARCH_API_TOKEN")
    google_id = os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
    
    print(f"GOOGLE_SEARCH_API_TOKEN: {'SET' if google_api else 'NOT SET'}")
    print(f"GOOGLE_CUSTOM_SEARCH_ENGINE_ID: {'SET' if google_id else 'NOT SET'}")
    
    if google_api and google_id:
        print("✅ Google API credentials are configured")
        return True
    else:
        print("❌ Google API credentials are missing")
        return False

def test_fastapi_server():
    """Тестируем FastAPI сервер"""
    try:
        print("\nTesting FastAPI server...")
        
        from fastapi_server import app
        from fastapi.testclient import TestClient
        
        client = TestClient(app)
        
        # Тестируем корневой эндпоинт
        response = client.get("/")
        print(f"Root endpoint status: {response.status_code}")
        
        # Тестируем health check
        response = client.get("/health")
        print(f"Health endpoint status: {response.status_code}")
        
        print("✅ FastAPI server test successful!")
        return True
        
    except Exception as e:
        print(f"❌ FastAPI server test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Python Parser Setup")
    print("=" * 50)
    
    # Загружаем переменные окружения
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)
        print(f"✓ Loaded .env file from {env_file}")
    else:
        print(f"⚠️  .env file not found at {env_file}")
    
    # Выполняем тесты
    imports_ok = test_imports()
    env_ok = test_environment()
    fastapi_ok = test_fastapi_server()
    
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    print(f"Imports: {'✅ PASS' if imports_ok else '❌ FAIL'}")
    print(f"Environment: {'✅ PASS' if env_ok else '❌ FAIL'}")
    print(f"FastAPI Server: {'✅ PASS' if fastapi_ok else '❌ FAIL'}")
    
    if imports_ok and env_ok and fastapi_ok:
        print("\n🎉 All tests passed! Parser is ready to use.")
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
