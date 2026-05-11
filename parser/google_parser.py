import asyncio
from typing import Dict, List, Optional
from urllib.parse import urlparse

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from loguru import logger

BATCH_SIZE = 10
MAX_RESULTS = 100


async def parse_page(
    token: str, cust: str, query: str, start: int, region: str
):
    def _fetch():
        service = build("customsearch", "v1", developerKey=token)
        return (
            service.cse()
            .list(
                q=query,
                cx=cust,
                num=BATCH_SIZE,
                start=start + 1,
                gl=region,
                hl=region,
                cr="country" + region.upper(),
            )
            .execute()
        )

    try:
        data = await asyncio.to_thread(_fetch)
        results = []
        for item in data.get("items", []):
            link = item.get("link")
            if not link:
                continue
            netloc = urlparse(link).netloc.lower()
            snippet = " ".join(
                item.get("snippet", "").replace("\u00a0", " ").split()
            )
            results.append({"domain": netloc, "description": snippet})
        return results
    except HttpError as e:
        if e.resp.status == 400:
            return []
        logger.error(f"HttpError at start {start}")
        return []


async def parse_google(
    token: str,
    cust: str,
    query: str,
    elements: int,
    region: str,
    user_id: Optional[str] = None,
) -> Optional[List[Dict[str, str]]]:
    logger.info(
        "Starting Google search for query: '{}' with elements: {}",
        query,
        elements,
    )
    if elements > MAX_RESULTS:
        logger.warning(
            f"Requested {elements} > {MAX_RESULTS}, limiting to {MAX_RESULTS} results."
        )

    to_fetch = min(elements, MAX_RESULTS, 91)  # CSE hard cap

    tasks = [
        parse_page(token, cust, query, start, region)
        for start in range(0, to_fetch, BATCH_SIZE)
    ]
    all_results = await asyncio.gather(*tasks)
    flat = [item for batch in all_results for item in batch]

    seen = set()
    unique_results = []
    for row in flat:
        domain = row["domain"]
        if domain not in seen:
            seen.add(domain)
            unique_results.append(
                {
                    "user_id": user_id,
                    "query": query,
                    "region": region,
                    "domain": "https://" + domain,
                    "description": row["description"],
                    "engine": "google",
                }
            )

    if not unique_results:
        logger.warning("No results returned; returning None.")
        return None

    logger.info(f"Total unique results: {len(unique_results)}")
    return unique_results
