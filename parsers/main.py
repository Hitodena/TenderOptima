
#!/usr/bin/env python3
import asyncio
import sys
import json
from datetime import datetime
from os import getenv
from pathlib import Path
from typing import Dict, List, Union
from urllib.parse import urlparse

from aiohttp import TCPConnector
from dotenv import load_dotenv

from info_getter import get_info
from search_manager import fetch_all
from utils.logger import CustomLogger
from utils.storage import get_today_cache_path, load_cache, save_to_csv, update_cache

# Load environment variables
load_dotenv("./.env")

google_custom_search_id = getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
google_search_api_token = getenv("GOOGLE_SEARCH_API_TOKEN")
yandex_key_path = getenv("YANDEX_KEY_PATH")
yandex_folder_id = getenv("YANDEX_FOLDER_ID")
concurrent_tasks_limit = int(getenv("LIMIT_CONCURRENT", 100))
connections_limit = int(getenv("LIMIT_CONNECTIONS", 500))
output_data = getenv("OUTPUT_DATA", "data")

root = Path(__file__).resolve().parent
data_dir = root / "data"
logger = CustomLogger("MainLogger", "MainLogger.log", debug=False, console=True).get_logger()


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

    root.joinpath(output_data).mkdir(parents=True, exist_ok=True)
    return True


async def parse(
    query: str,
    user_id: str,
    elements: int,
    region: str,
    search_engines: List[str],
) -> List[Dict[str, Union[str, List[str]]]]:
    """
    Orchestrates:
      1) Load daily cache
      2) If cache miss -> fetch search results
      3) Extract domains and fetch contact info
      4) Merge contacts into results
      5) Update cache and save output CSV
    """
    # Setup and validation
    if not setup(search_engines):
        return []

    cache_file = get_today_cache_path(query, data_dir)
    output_file = data_dir / "data.csv"

    # 1) Try daily cache
    cached = load_cache(query, cache_file, data_dir)
    if cached:
        logger.info(f"Cache hit for '{query}': {len(cached)} rows")
        return cached

    logger.info(f"Cache miss for '{query}', querying engines: {search_engines} with region: '{region}'")
    raw_results = await fetch_all(
        query=query,
        user_id=user_id,
        elements=elements,
        region=region,
        google_search_api=google_search_api_token or "",
        google_search_id=google_custom_search_id or "",
        yandex_key_file=Path(yandex_key_path) if yandex_key_path else Path(""),
        yandex_folder_id=yandex_folder_id or "",
    )

    if not raw_results:
        logger.warning(f"No search results for '{query}'")
        return []

    # 3) Extract unique domains from result links
    domains = [item["domain"] for item in raw_results if isinstance(item.get("domain"), str)]
    logger.info(f"Extracting contacts for {len(domains)} domains")

    # 4) Try to fetch contact info for each domain
    contacts_map = {}
    try:
        semaphore = asyncio.Semaphore(concurrent_tasks_limit)
        connector = TCPConnector(limit=connections_limit)
        contacts = await get_info(domains, semaphore, connector, region)
        contacts_map = {urlparse(c["url"]).netloc: c for c in contacts if isinstance(c.get("url"), str)}
        logger.info(f"Successfully extracted contacts for {len(contacts_map)} domains")
    except Exception as e:
        logger.warning(f"Contact extraction failed: {str(e)}. Returning results without contact info.")

    # 5) Merge contacts back into search results (only include suppliers with emails)
    enriched = []
    for item in raw_results:
        domain_url = item.get("domain", "")
        if isinstance(domain_url, str):
            domain = urlparse(domain_url).netloc
            contact = contacts_map.get(domain)
            
            # Only add to results if contact info with emails is found
            if contact and contact.get("emails"):
                item["emails"] = contact["emails"]
                item["phones"] = contact.get("phones", [])
                item["dateOfSearch"] = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
                enriched.append(item)

    # 6) Update cache and save CSV
    if enriched:
        update_cache(enriched, cache_file, data_dir, query)
        save_to_csv(enriched, output_file)
        logger.info(f"Saved {len(enriched)} results to {output_file} (with {len(contacts_map)} having contact info)")
    else:
        logger.warning(f"No results to save for query '{query}'")

    return enriched


async def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 5:
        print("Usage: python main.py <query> <elements> <user_id> <region>")
        sys.exit(1)

    query = sys.argv[1]
    elements = int(sys.argv[2])
    user_id = sys.argv[3]
    # Считываем регион из 4-го аргумента - он должен быть обязательно передан
    if len(sys.argv) <= 4:
        logger.error("Region parameter is required but not provided")
        sys.exit(1)
    region = sys.argv[4]
    logger.info(f"Using user-selected region: '{region}' for search query: '{query}'")

    # Определяем доступные поисковые системы
    search_engines = ["google"]  # По умолчанию всегда используем Google
    
    # Add Yandex if key file exists
    if yandex_key_path and Path(yandex_key_path).exists():
        search_engines.append("yandex")

    try:
        results = await parse(query, user_id, elements, region, search_engines)
        
        # Output results as JSON to stdout for Node.js to parse
        print(json.dumps(results, ensure_ascii=False, indent=2))
        
    except Exception as e:
        logger.error(f"Error in main: {e}")
        print(json.dumps([], ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
