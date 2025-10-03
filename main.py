import sys
from pathlib import Path

# Этот код добавляет корневую папку проекта в пути поиска Python.
# Path(__file__).resolve().parent гарантирует получение правильного пути
# даже при запуске в дочерних процессах uvicorn.
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

import asyncio
from datetime import datetime
from os import getenv
from pathlib import Path
from typing import Dict, List, Union
from urllib.parse import urlparse
import logging

from aiohttp import TCPConnector
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from contextlib import asynccontextmanager

# --- Импорты из вашего проекта ---
# Они будут работать, так как main.py находится в корне
from parsers.info_getter import get_info
from parsers.search_manager import fetch_all
from parsers.utils import storage

# Загрузка переменных окружения
load_dotenv()

# Настройка логгера для вывода в консоль Replit
logger = logging.getLogger("uvicorn.error")

# Получение всех необходимых ключей и настроек
google_custom_search_id = getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
google_search_api_token = getenv("GOOGLE_SEARCH_API_TOKEN")
yandex_key_path = getenv("YANDEX_KEY_PATH")
yandex_folder_id = getenv("YANDEX_FOLDER_ID")
concurrent_tasks_limit = int(getenv("LIMIT_CONCURRENT", 50))
connections_limit = int(getenv("LIMIT_CONNECTIONS", 500))

# --- Инициализация FastAPI ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Сервер запускается, инициализация БД...")
    await storage.create_table_if_not_exists()
    yield
    logger.info("Сервер останавливается...")
    pool = await storage.get_pool()
    if pool:
        await pool.close()

app = FastAPI(lifespan=lifespan)

# --- Модель данных ---
class ParseRequest(BaseModel):
    query: str
    user_id: str = "default_user"
    elements: int = 50
    region: str = "ru"
    regions: List[str] = []  # Добавляем поддержку множественных регионов
    search_engines: List[str] = ["google"]

# --- API Эндпоинты ---
@app.get("/")
def read_root():
    return {"status": "ok"}

@app.post("/parse")
async def handle_parse(request: ParseRequest):
    logger.info(f"Получен запрос на парсинг: '{request.query}'")
    results = await parse(
        query=request.query,
        user_id=request.user_id,
        elements=request.elements,
        region=request.region,
        search_engines=request.search_engines
    )
    return {"data": results}

@app.post("/search")
async def handle_search(request: ParseRequest):
    """Новый эндпоинт для поддержки множественных регионов"""
    logger.info(f"Получен запрос на поиск: '{request.query}' с регионами: {request.regions}")
    
    # Если переданы множественные регионы, выполняем поиск для каждого
    if request.regions and len(request.regions) > 0:
        all_results = []
        for region in request.regions[:5]:  # Ограничиваем максимум 5 регионами
            logger.info(f"Поиск в регионе: {region}")
            region_results = await parse(
                query=request.query,
                user_id=request.user_id,
                elements=request.elements,
                region=region,
                search_engines=request.search_engines
            )
            all_results.extend(region_results)
        
        # Дедупликация результатов по домену
        seen_domains = set()
        unique_results = []
        for result in all_results:
            domain = result.get("domain", "")
            if domain and domain not in seen_domains:
                seen_domains.add(domain)
                unique_results.append(result)
        
        logger.info(f"Найдено {len(unique_results)} уникальных результатов из {len(all_results)} общих")
        return {"results": unique_results}
    else:
        # Обычный поиск с одним регионом
        results = await parse(
            query=request.query,
            user_id=request.user_id,
            elements=request.elements,
            region=request.region,
            search_engines=request.search_engines
        )
        return {"results": results}

# --- Основная логика ---
async def parse(
    query: str,
    user_id: str,
    elements: int,
    region: str,
    search_engines: List[str],
    sources: dict = None,
    excluded_domains: List[str] = None
) -> List[Dict]:
    """
    Основная функция парсинга с включенной логикой скрапинга контактов.
    """
    # 1. Проверка кэша в БД
    data_dir = Path("parsers/data")
    data_dir.mkdir(exist_ok=True)
    cache_file = storage.get_today_cache_path(query, data_dir)
    cached_results = storage.load_cache(query, cache_file, data_dir)
    #if cached_results:
    #    logger.info(f"Найдены результаты в кэше для '{query}'.")
    #    return cached_results

    logger.info(f"Кэш пуст для '{query}'. Запускаем поиск в {search_engines}...")

    # 2. Поиск сайтов
    raw_results = await fetch_all(
        query=query,
        user_id=user_id,
        elements=elements,
        region=region,
        google_search_api=google_search_api_token,
        google_search_id=google_custom_search_id,
        yandex_key_file=Path(yandex_key_path) if yandex_key_path else None,
        yandex_folder_id=yandex_folder_id,
        sources=sources,
        excluded_domains=excluded_domains
    )

    if not raw_results:
        logger.warning("Поиск не вернул ни одного сайта.")
        return []

    logger.info(f"Поиск вернул {len(raw_results)} сайтов. Начинаем скрапинг контактов.")

    # 3. Скрапинг контактов с найденных сайтов
    domains = [item.get("domain") for item in raw_results if item.get("domain")]

    contacts = await get_info(domains, concurrent_tasks_limit)
    contacts_map = {urlparse(c["url"]).netloc: c for c in contacts if c}

    # 4. Обогащение результатов и фильтрация
    timestamp = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    enriched_results = []
    for item in raw_results:
        domain = urlparse(item["domain"]).netloc
        info = contacts_map.get(domain)

        # Ключевая проверка: добавляем в результат только если найден email
        if info and info.get("emails"):
            item["emails"] = info["emails"]
            item["phones"] = info.get("phones", [])
            item["dateOfSearch"] = timestamp
            enriched_results.append(item)
        else:
            logger.info(f"Отбрасываем домен '{domain}', так как не найдены email.")

    # 5. Сохранение обогащенных результатов в БД
    if enriched_results:
        logger.info(f"Сохраняем в кэш {len(enriched_results)} записей.")
        storage.update_cache(enriched_results, cache_file, data_dir, query)
    else:
        logger.warning("После скрапинга и фильтрации не осталось ни одного результата.")

    logger.info(f"Возвращено {len(enriched_results)} обогащенных записей.")
    return enriched_results


async def main_search(
    query: str,
    user_id: str,
    elements: int,
    region: str,
    google_search_api: str,
    google_search_id: str,
    yandex_key_file: Path = None,
    yandex_folder_id: str = None,
    sources: dict = None,
    excluded_domains: List[str] = None,
    regions: List[str] = None  # Добавляем поддержку множественных регионов
) -> List[Dict]:
    """
    Wrapper function for the main search functionality that matches the FastAPI server interface.
    """
    # Convert parameters to match the parse function
    search_engines = []
    
    # Check sources parameter to determine which engines to use
    if sources:
        if sources.get('google', False) and google_search_api and google_search_id:
            search_engines.append("google")
        if sources.get('yandex', False) and yandex_key_file and yandex_folder_id:
            search_engines.append("yandex")
    else:
        # Default behavior if no sources specified
        search_engines = ["google"]
        if yandex_key_file and yandex_folder_id:
            search_engines.append("yandex")
    
    # Если переданы множественные регионы, выполняем поиск для каждого
    if regions and len(regions) > 0:
        all_results = []
        for search_region in regions[:5]:  # Ограничиваем максимум 5 регионами
            logger.info(f"Поиск в регионе: {search_region}")
            region_results = await parse(
                query=query,
                user_id=user_id,
                elements=elements,
                region=search_region,
                search_engines=search_engines,
                sources=sources,
                excluded_domains=excluded_domains
            )
            all_results.extend(region_results)
        
        # Дедупликация результатов по домену
        seen_domains = set()
        unique_results = []
        for result in all_results:
            domain = result.get("domain", "")
            if domain and domain not in seen_domains:
                seen_domains.add(domain)
                unique_results.append(result)
        
        logger.info(f"Найдено {len(unique_results)} уникальных результатов из {len(all_results)} общих")
        return unique_results
    else:
        # Обычный поиск с одним регионом
        return await parse(
            query=query,
            user_id=user_id,
            elements=elements,
            region=region,
            search_engines=search_engines,
            sources=sources,
            excluded_domains=excluded_domains
        )
