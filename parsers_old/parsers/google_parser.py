
import asyncio
from typing import Dict, List, Optional
from urllib.parse import urlparse

from googleapiclient.errors import HttpError
from langchain_google_community import GoogleSearchAPIWrapper

from ..utils.logger import CustomLogger

logger = CustomLogger("GoogleParser", "GoogleParser.log", debug=False, console=True).get_logger()


async def parse_page(
    search: GoogleSearchAPIWrapper, query: str, start: int, region: str
) -> List[Dict[str, str]]:
    """
    Parses a single page of Google search results.

    Args:
        search (GoogleSearchAPIWrapper): Langchain wrapper for Google API.
        query (str): Search query.
        start (int): Offset for pagination.
        region (str): Region code (e.g., 'ru').

    Returns:
        List[Dict[str, str]]: List of dictionaries with domain and description.
    """
    try:
        params = {"gl": region, "hl": region, "cr": f"country{region.upper()}", "start": start}
        logger.info(f"Google search params: {params}")
        
        batch = await asyncio.to_thread(search.results, query, 10, params)
        logger.info(f"Google search returned {len(batch) if batch else 0} results")

        results = []
        for item in batch:
            link = item.get("link")

            if not link:
                continue

            netloc = urlparse(link).netloc.lower()
            raw = item.get("snippet", "").replace("\u00a0", " ").strip()
            description = " ".join(raw.split()) if raw else ""

            results.append({"domain": netloc, "description": description})

        logger.debug(f"Parsed {len(results)} results for start {start}")
        return results

    except HttpError as e:
        # stop on invalid argument (start > 90) or quota end, but continue with what we have
        if e.resp.status == 400:
            logger.warning(f"Google CSE badRequest at start={start}, continuing with partial results")
            return []
        logger.warning(f"HttpError at start {start} - quota limit, continuing with partial results")
        return []
    except Exception as e:
        logger.warning(f"Error parsing start {start}: {str(e)[:100]}, continuing with partial results")
        return []


async def parse_google(
    token: str,
    cust: str,
    query: str,
    elements: int,
    region: str,
    user_id: Optional[str] = None,
) -> Optional[List[Dict[str, str]]]:
    """
    Parses Google search results in parallel and returns cleaned domain-description pairs.

    Args:
        query (str): Search query.
        elements (int): Total number of elements to parse.
        region (str): Region code.
        user_id (str, optional): ID of the user requesting the search.

    Returns:
        List[Dict[str, str]]: Filtered search results with user_id included if provided.
    """
    max_allowed = 100
    if elements > max_allowed:
        logger.warning(f"Requested {elements} > {max_allowed}, limiting to {max_allowed} results.")
    to_fetch = min(elements, max_allowed)

    logger.info(f"Initializing Google Search API with token: {'SET' if token else 'NOT SET'}, CSE ID: {'SET' if cust else 'NOT SET'}")
    search = GoogleSearchAPIWrapper(google_api_key=token, google_cse_id=cust)
    tasks = [parse_page(search, query, start, region) for start in range(0, to_fetch, 10)]

    all_results = await asyncio.gather(*tasks)
    flat = [item for batch in all_results for item in batch]

    seen = set()
    unique_results = []
    for row in flat:
        domain = row["domain"]

        if domain not in seen:
            seen.add(domain)
            result = {
                "user_id": user_id,
                "query": query,
                "domain": "https://" + domain,
                "description": row["description"],
                "engine": "google",
            }

            unique_results.append(result)

    if not unique_results:
        logger.warning("No results returned; returning None.")
        return None

    logger.info(f"Total unique results: {len(unique_results)}")
    return unique_results
