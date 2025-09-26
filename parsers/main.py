import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import aiohttp

from info_getter import get_info
from search_manager import fetch_all
from utils.logger import CustomLogger
from utils import storage

logger = CustomLogger(
    logger_name="SupplierFinderParser", file_path="SupplierFinderParser.log", debug=True, console=True
).get_logger()

# Configuration
MAX_CONCURRENT_REQUESTS = 10
DEFAULT_ELEMENTS = 50
DEFAULT_REGION = "ru"
DATA_DIR = Path(__file__).resolve().parent / "data"


async def main_search(
    query: str,
    user_id: str = "1",
    elements: int = DEFAULT_ELEMENTS,
    region: str = DEFAULT_REGION,
    google_search_api: Optional[str] = None,
    google_search_id: Optional[str] = None,
    yandex_key_file: Optional[Path] = None,
    yandex_folder_id: Optional[str] = None,
    sources: dict = {},
    excluded_domains: List[str] = [],  # Восстанавливаем параметр стоп-листа
) -> List[Dict]:
    """
    Main search function that orchestrates Google and Yandex searches with contact extraction.
    
    Args:
        query: Search query
        user_id: User identifier
        elements: Number of results to fetch
        region: Search region
        google_search_api: Google API key
        google_search_id: Google Custom Search Engine ID
        yandex_key_file: Path to Yandex service account key file
        yandex_folder_id: Yandex Cloud folder ID
    
    Returns:
        List of enriched supplier data with contact information
    """
    logger.info(f"Starting search for query: '{query}' with {elements} elements, excluding {len(excluded_domains)} domains")
    
    # Validate API credentials
    has_google = google_search_api and google_search_id
    has_yandex = yandex_key_file and yandex_folder_id
    
    if not has_google and not has_yandex:
        logger.error("No valid API credentials provided")
        return []
    
    # Step 1: Search for domains using Google and/or Yandex
    try:
        # Ensure we have values for all parameters
        google_api = google_search_api or ""
        google_id = google_search_id or ""
        yandex_key = yandex_key_file or Path("dummy")
        yandex_folder = yandex_folder_id or ""
        
        search_results = await fetch_all(
            query=query,
            user_id=user_id,
            elements=elements,
            region=region,
            google_search_api=google_api,
            google_search_id=google_id,
            yandex_key_file=yandex_key,
            yandex_folder_id=yandex_folder,
            sources=sources,
            excluded_domains=excluded_domains,  # Передаем стоп-лист в fetch_all
        )
        
        if not search_results:
            logger.warning("No search results found")
            return []
            
        logger.info(f"Found {len(search_results)} domains from search engines (after query-level exclusions)")
        
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []
    
    # Step 2: Extract contact information
    try:
        domains = [result["domain"] for result in search_results]
        
        # Setup for contact extraction
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        connector = aiohttp.TCPConnector(limit=100, ttl_dns_cache=300, use_dns_cache=True)
        
        # Get contact information
        contact_results = await get_info(domains, MAX_CONCURRENT_REQUESTS)
        
        logger.info(f"Extracted contacts from {len(contact_results)} domains")
        
    except Exception as e:
        logger.error(f"Contact extraction failed: {e}")
        contact_results = []
    
    # Step 3: Merge search results with contact information
    enriched_results = []
    contact_map = {result["domain"]: result for result in contact_results}
    
    for search_result in search_results:
        domain = search_result["domain"]
        contact_info = contact_map.get(domain, {})
        
        # Only include suppliers with valid email addresses
        emails = contact_info.get("emails", [])
        phones = contact_info.get("phones", [])
        
        if emails:  # Only save suppliers with authentic email addresses
            enriched_result = {
                "user_id": search_result["user_id"],
                "query": search_result["query"],
                "domain": search_result["domain"],
                "description": search_result["description"],
                "engine": search_result["engine"],
                "emails": emails,
                "phones": phones,
                "dateOfSearch": datetime.now().isoformat(),
            }
            enriched_results.append(enriched_result)
    
    logger.info(f"Final results: {len(enriched_results)} suppliers with authentic contact information")
    
    # Step 4: Save results if any found
    if enriched_results:
        DATA_DIR.mkdir(exist_ok=True)
        save_to_csv(enriched_results, DATA_DIR / "results.csv")
    
    return enriched_results


if __name__ == "__main__":
    # Example usage
    if len(sys.argv) < 2:
        print("Usage: python main.py 'search query' [elements] [user_id]")
        sys.exit(1)
    
    query = sys.argv[1]
    elements = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_ELEMENTS
    user_id = sys.argv[3] if len(sys.argv) > 3 else "1"
    
    # Load environment variables for API keys     
    google_api = os.getenv("GOOGLE_SEARCH_API_TOKEN")
    google_id = os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
    yandex_key_path = os.getenv("YANDEX_KEY_PATH")
    yandex_folder = os.getenv("YANDEX_FOLDER_ID")
    
    yandex_key_file = Path(yandex_key_path) if yandex_key_path else None
    
    # Run the search
    results = asyncio.run(
        main_search(
            query=query,
            user_id=user_id,
            elements=elements,
            google_search_api=google_api,
            google_search_id=google_id,
            yandex_key_file=yandex_key_file,
            yandex_folder_id=yandex_folder,
        )
    )
    
    print(f"Search completed. Found {len(results)} suppliers with contact information.")
    for result in results:
        print(f"- {result['domain']}: {len(result['emails'])} emails, {len(result['phones'])} phones")