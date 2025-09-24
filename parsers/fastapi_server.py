#!/usr-bin/env python3
"""
FastAPI сервер для Python парсера поставщиков
"""
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Загружаем переменные окружения из .env в корневой папке
project_root = Path(__file__).resolve().parent.parent
env_path = project_root / ".env"
print(f"DEBUG: project_root = {project_root}")
print(f"DEBUG: env_path = {env_path}")
print(f"DEBUG: env_path.exists() = {env_path.exists()}")
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"DEBUG: .env file loaded successfully")
    # Проверяем, что загрузилось из .env
    print(f"DEBUG: YANDEX_KEY_PATH from .env = {os.getenv('YANDEX_KEY_PATH')}")
    print(f"DEBUG: YANDEX_FOLDER_ID from .env = {os.getenv('YANDEX_FOLDER_ID')}")
    
    # Принудительно устанавливаем правильные пути
    correct_yandex_key_path = "C:\\Users\\andda\\Downloads\\SupplierFinder\\parsers\\yand_keygud.json"
    os.environ['YANDEX_KEY_PATH'] = correct_yandex_key_path
    os.environ['YANDEX_KEY_FILE'] = correct_yandex_key_path
    print(f"DEBUG: Force set YANDEX_KEY_PATH = {correct_yandex_key_path}")
    print(f"DEBUG: Force set YANDEX_KEY_FILE = {correct_yandex_key_path}")
else:
    print(f"DEBUG: .env file not found at {env_path}")

from main import main_search
from parsers.utils.logger import CustomLogger

# Настройка логирования
logger = CustomLogger(
    logger_name="FastAPIServer", file_path="FastAPIServer.log", debug=True, console=True
).get_logger()

# FastAPI приложение
app = FastAPI(
    title="Supplier Parser API", 
    version="1.0.0",
    description="API для поиска поставщиков через Google и Yandex"
)

# Pydantic модели
class SearchRequest(BaseModel):
    query: str
    elements: int = 10
    user_id: str = "1"
    region: str = "ru"
    sources: dict = {}
    excluded_domains: List[str] = []  # Восстанавливаем поддержку стоп-листа

class SearchResponse(BaseModel):
    results: List[Dict]
    message: str = "Search completed"

@app.get("/")
async def root():
    """Проверка работоспособности API"""
    return {
        "message": "Supplier Parser API is running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "google_api_configured": bool(os.getenv("GOOGLE_SEARCH_API_TOKEN")),
        "google_cse_configured": bool(os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")),
        "yandex_api_configured": bool(os.getenv("YANDEX_KEY_PATH")),
        "yandex_folder_configured": bool(os.getenv("YANDEX_FOLDER_ID"))
        
    }

@app.post("/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest):
    """
    Основной эндпоинт для поиска поставщиков
    """
    try:
        logger.info(f"Received search request: query='{request.query}', elements={request.elements}, user_id={request.user_id}, region={request.region}, sources={request.sources}, excluded_domains={request.excluded_domains}")
        
        # Загружаем переменные окружения
        google_api = os.getenv("GOOGLE_SEARCH_API_TOKEN")
        google_id = os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
        yandex_key_path = os.getenv("YANDEX_KEY_PATH")
        yandex_folder = os.getenv("YANDEX_FOLDER_ID")
        
        # Отладочная информация
        logger.info(f"All environment variables containing 'YANDEX':")
        for key, value in os.environ.items():
            if 'YANDEX' in key.upper():
                logger.info(f"  {key} = {value}")
        
        # Проверяем наличие Google API ключей
        if not google_api or not google_id:
            logger.error("Google API credentials not configured")
            raise HTTPException(
                status_code=500, 
                detail="Google API credentials not configured. Please set GOOGLE_SEARCH_API_TOKEN and GOOGLE_CUSTOM_SEARCH_ENGINE_ID"
            )
        
        logger.info("Google API credentials found, proceeding with search")
        logger.info(f"Yandex folder: {yandex_folder}")
        logger.info(f"Yandex key file exists: {Path(yandex_key_path).exists() if yandex_key_path else False}")
        logger.info(f"Yandex key path: {yandex_key_path}")
        logger.info(f"Yandex key file exists: {Path(yandex_key_path).exists() if yandex_key_path else False}")
        # Подготавливаем параметры для Yandex (если есть)
        yandex_key_file = Path(yandex_key_path) if yandex_key_path else None
        
        # Выполняем поиск
        results = await main_search(
            query=request.query,
            user_id=request.user_id,
            elements=request.elements,
            region=request.region,
            google_search_api=google_api,
            google_search_id=google_id,
            yandex_key_file=yandex_key_file,
            yandex_folder_id=yandex_folder,
            sources=request.sources,
            excluded_domains=request.excluded_domains  # Передаем стоп-лист
        )
        
        logger.info(f"Search completed: found {len(results)} suppliers with contact information")
        
        return SearchResponse(
            results=results,
            message=f"Found {len(results)} suppliers with contact information"
        )
        
    except HTTPException:
        # Перебрасываем HTTP исключения как есть
        raise
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    # Проверяем переменные окружения при запуске
    google_api = os.getenv("GOOGLE_SEARCH_API_TOKEN")
    google_id = os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
    
    if not google_api or not google_id:
        logger.warning("Google API credentials not found in environment variables")
        logger.warning("Please set GOOGLE_SEARCH_API_TOKEN and GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
    
    logger.info("🚀 Starting FastAPI server on port 8080...")
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8080, log_level="info")
