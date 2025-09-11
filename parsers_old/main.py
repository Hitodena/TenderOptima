#!/usr/bin/env python3
import asyncio
import json
from datetime import datetime
from os import getenv
from pathlib import Path
from typing import Dict, List, Union
from urllib.parse import urlparse

from aiohttp import TCPConnector
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .info_getter import get_info
from .search_manager import fetch_all
from .utils.logger import CustomLogger
from .utils.storage import get_today_cache_path, load_cache, save_to_csv, update_cache

# Load environment variables
import os
from pathlib import Path

# Получаем путь к корневой папке проекта
root_dir = Path(__file__).parent.parent
env_path = root_dir / ".env"

print(f"[PythonParser] Looking for .env file at: {env_path}")
print(f"[PythonParser] .env file exists: {env_path.exists()}")

load_dotenv(env_path)

google_custom_search_id = getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
google_search_api_token = getenv("GOOGLE_SEARCH_API_TOKEN")
yandex_key_path = getenv("YANDEX_KEY_PATH")
yandex_folder_id = getenv("YANDEX_FOLDER_ID")
concurrent_tasks_limit = int(getenv("LIMIT_CONCURRENT", 100))
connections_limit = int(getenv("LIMIT_CONNECTIONS", 500))
output_data = getenv("OUTPUT_DATA", "data")

# Отладочная информация
print(f"[PythonParser] Google Custom Search ID: {'SET' if google_custom_search_id else 'NOT SET'}")
print(f"[PythonParser] Google Search API Token: {'SET' if google_search_api_token else 'NOT SET'}")
print(f"[PythonParser] Yandex Key Path: {'SET' if yandex_key_path else 'NOT SET'}")
print(f"[PythonParser] Yandex Folder ID: {'SET' if yandex_folder_id else 'NOT SET'}")

# Определяем корневую папку parsers
parsers_root = Path(__file__).resolve().parent
data_dir = parsers_root / "data"
print(f"[PythonParser] Parsers root directory: {parsers_root}")
print(f"[PythonParser] Data directory: {data_dir}")
logger = CustomLogger("MainLogger", "MainLogger.log", debug=False, console=True).get_logger()

# FastAPI app
app = FastAPI(title="Supplier Parser API", version="1.0.0")

# Pydantic models
class SearchRequest(BaseModel):
    query: str
    elements: int = 10
    user_id: str = "1"
    region: str = "by"

class SearchResponse(BaseModel):
    results: List[Dict]
    message: str = "Search completed"

def setup(search_engines: List[str]) -> bool:
    """
    Validate environment and create output folders.
    Returns False if setup fails.
    """
    if "yandex" in search_engines and not (yandex_folder_id or yandex_key_path):
        logger.error("No yandex credentials, please check it in .env")
        return False

    if "google" in search_engines and not (google_custom_search_id or google_search_api_token):
        logger.error("No google credentials, please check it in .env")
        return False

    (parsers_root / output_data).mkdir(parents=True, exist_ok=True)
    return True

async def parse(
    query: str,
    user_id: str,
    elements: int,
    region: str,
    search_engines: List[str],
) -> List[Dict]:
    """
    Main parsing function that orchestrates the entire search and extraction process.
    """
    logger.info(f"Starting parse for query: '{query}', user: {user_id}, elements: {elements}, region: {region}")

    if not setup(search_engines):
        logger.error("Setup failed, aborting parse")
        return []

    # Check cache first
    cache_file = get_today_cache_path(query, data_dir)
    cached = load_cache(query, cache_file, data_dir)
    
    if cached:
        logger.info(f"Cache hit for '{query}': {len(cached)} rows")
        return cached

    logger.info(f"Cache miss for '{query}', querying engines: {search_engines}")

    try:
        # Perform search
        search_results = await fetch_all(
            query=query,
            user_id=user_id,
            elements=elements,
            region=region,
            google_search_api=google_search_api_token,
            google_search_id=google_custom_search_id,
            yandex_key_file=Path(yandex_key_path) if yandex_key_path else None,
            yandex_folder_id=yandex_folder_id,
        )

        if not search_results:
            logger.warning(f"No search results for '{query}'")
            return []

        logger.info(f"Found {len(search_results)} search results, starting contact extraction")

        # Extract contact information
        enriched = []
        connector = TCPConnector(limit=connections_limit, limit_per_host=concurrent_tasks_limit)
        
        async with connector:
            for item in search_results:
                try:
                    contact = await get_info(item["domain"], connector)
                    if contact and contact.get("emails"):
                        item["emails"] = contact["emails"]
                        item["phones"] = contact.get("phones", [])
                        enriched.append(item)
                        logger.debug(f"Enriched {item['domain']} with {len(contact['emails'])} emails")
                    else:
                        logger.debug(f"No contact info found for {item['domain']}")
                except Exception as e:
                    logger.warning(f"Failed to get contact info for {item['domain']}: {e}")
                    continue

        if not enriched:
            logger.warning(f"No suppliers found with authentic contact information for '{query}'")
            return []

        # Save to cache and CSV
        update_cache(query, enriched, cache_file, data_dir)
        save_to_csv(enriched, data_dir)

        logger.info(f"Parse completed: {len(enriched)} suppliers with contact info")
        return enriched

    except Exception as e:
        logger.error(f"Error in parse: {e}")
        return []

@app.get("/")
async def root():
    return {"message": "Supplier Parser API is running"}

@app.post("/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest):
    try:
        logger.info(f"Received search request: {request.query}")
        
        # Определяем доступные поисковые системы
        search_engines = ["google"]  # По умолчанию всегда используем Google
        
        # Add Yandex if key file exists
        if yandex_key_path and Path(yandex_key_path).exists():
            search_engines.append("yandex")

        results = await parse(
            query=request.query,
            user_id=request.user_id,
            elements=request.elements,
            region=request.region,
            search_engines=search_engines
        )
        
        return SearchResponse(
            results=results,
            message=f"Found {len(results)} suppliers with contact information"
        )
        
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)