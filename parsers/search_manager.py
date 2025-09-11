import asyncio
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse, urlunparse

from parsers.google_parser import parse_google
from parsers.yandex_parser import yandex_fetch_all
from utils.logger import CustomLogger

# ============ Configuration ============

# Logger setup
logger = CustomLogger(
    logger_name="SearchManager", file_path="SearchManager.log", debug=False, console=True
).get_logger()


def normalize_link(link: str) -> str:
    """
    Normalize URL for deduplication: lowercase scheme and netloc,
    remove trailing slash, ignore query and fragment.
    """
    parsed = urlparse(link)
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    normalized = urlunparse((scheme, netloc, path, "", "", ""))
    return normalized


async def fetch_all(
    query: str,
    user_id: str,
    elements: int,
    region: str,
    google_search_api: str,
    google_search_id: str,
    yandex_key_file: Path,
    yandex_folder_id: str,
) -> List[Dict]:
    """
    Unified fetcher: queries Google and Yandex in parallel,
    merges and deduplicates results by normalized URL.

    Args:
        query (str): Search query.
        user_id (str): ID of the requesting user.
        elements (int): Total results.
        google_search_api (str): Google API token.
        google_search_id (str): Google CSE ID.
        yandex_key_file (Path): Path to Yandex key file.
        yandex_folder_id (str): Yandex folder ID.

    Returns:
        List[Dict]: Deduplicated list of combined results.
    """
    # Concurrently fetch from both engines
    google_task = parse_google(
        query=query,
        elements=elements,
        region=region,
        user_id=user_id,
        token=google_search_api,
        cust=google_search_id,
    )
    
    yandex_task = None
    if yandex_key_file and yandex_folder_id:
        yandex_task = yandex_fetch_all(
            user_id=user_id,
            query=query,
            total_results=elements,
            key_file=yandex_key_file,
            folder_id=yandex_folder_id,
        )

    tasks = [task for task in [google_task, yandex_task] if task is not None]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Merge
    combined: List[Dict] = []
    for res in results:
        if res and not isinstance(res, Exception):
            combined.extend(res)

    if not combined:
        logger.warning("No results from any engine; returning empty list.")
        return []

    # Deduplicate by normalized URL
    seen = set()
    unique_results: List[Dict] = []
    for item in combined:
        link = item.get("domain", "")
        norm = normalize_link(link)
        if norm not in seen:
            seen.add(norm)
            unique_results.append(item)
        else:
            logger.debug(f"Duplicate skipped: {link}")

    logger.info(f"Deduplicated results: {len(unique_results)} unique out of {len(combined)} total")
    return unique_results