import asyncio
from pathlib import Path
from typing import Union
from urllib.parse import urlparse, urlunparse

from loguru import logger

from parser.google_parser import parse_google
from parser.yandex_parser import yandex_fetch_all


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


def add_city_to_queries(original_query: str, city_name: str) -> str:
    """
    Добавляет название города к каждому подзапросу, разделенному запятой

    Args:
        original_query: "купить стулья, стулья от производителя"
        city_name: "Минск"

    Returns:
        "купить стулья Минск, стулья от производителя Минск"
    """
    queries = [q.strip() for q in original_query.split(",") if q.strip()]
    modified_queries = [f"{query} {city_name}" for query in queries]
    return ", ".join(modified_queries)


def prepare_query_for_region(
    original_query: str, region_object: Union[dict, None]
) -> str:
    """
    Модифицирует запрос в зависимости от типа региона

    Args:
        original_query: Исходный запрос пользователя
        region_object: Объект региона с полями name, type, yandexId, googleCode

    Returns:
        Модифицированный или оригинальный запрос
    """
    if not region_object or not isinstance(region_object, dict):
        return original_query

    if region_object.get("type") == "country":
        logger.info(
            f"Region is country, using original query: {original_query}"
        )
        return original_query

    city_name = region_object.get("name", "")
    if city_name:
        modified_query = add_city_to_queries(original_query, city_name)
        logger.info(
            f"Region is city/oblast: '{original_query}' -> '{modified_query}'"
        )
        return modified_query

    return original_query


def build_exclusion_query(
    query: str, excluded_domains: list[str], search_engine: str
) -> str:
    """
    Строит модифицированный поисковый запрос с исключениями доменов.

    Args:
        query: Оригинальный поисковый запрос
        excluded_domains: Список доменов для исключения
        search_engine: Поисковая система ("google" или "yandex")

    Returns:
        Модифицированный запрос с исключениями
    """
    if not excluded_domains:
        return query

    exclusions = []
    for domain in excluded_domains:
        clean_domain = (
            domain.replace("https://", "")
            .replace("http://", "")
            .replace("www.", "")
        )
        if search_engine == "google":
            exclusions.append(f"-site:{clean_domain}")
        elif search_engine == "yandex":
            exclusions.append(f"-site:{clean_domain}")

    if exclusions:
        modified_query = f"{query} {' '.join(exclusions)}"
        logger.info(
            f"Modified {search_engine} query with exclusions: '{query}' -> '{modified_query}'"
        )
        return modified_query

    return query


def get_yandex_region_code(region) -> int:
    """
    Convert region string to Yandex region code.

    Args:
        region: Region string (e.g., 'ru', 'by', 'ua', 'kz')

    Returns:
        Yandex region code (int)
    """
    region_mapping = {
        "ru": 225,
        "by": 149,
        "ua": 187,
        "kz": 159,
        "uz": 191,
        "kg": 118,
        "tj": 186,
        "tm": 189,
        "am": 7,
        "az": 10,
        "ge": 35,
        "md": 139,
    }

    if isinstance(region, str):
        return region_mapping.get(region.lower(), 225)
    elif isinstance(region, int):
        return region
    elif isinstance(region, dict):
        yandex_id = region.get("yandexId") or region.get("yandex_id")
        if yandex_id:
            return yandex_id

    return 225


async def fetch_all(
    query: str,
    user_id: str,
    elements: int,
    region: Union[str, dict],
    google_search_api: str,
    google_search_id: str,
    yandex_key_file: Path,
    yandex_folder_id: str,
    excluded_domains: list[str] = [],
) -> list[dict]:
    """
    Unified fetcher: queries Google and Yandex in parallel,
    merges and deduplicates results by normalized URL.

    Args:
        query (str): Search query.
        user_id (str): ID of the requesting user.
        elements (int): Total results.
        region (Union[str, dict]): Region code or region object
        google_search_api (str): Google API token.
        google_search_id (str): Google CSE ID.
        yandex_key_file (Path): Path to Yandex key file.
        yandex_folder_id (str): Yandex folder ID.
        excluded_domains (list[str]): list of domains to exclude from search

    Returns:
        list[dict]: Deduplicated list of combined results.
    """

    logger.info(f"Excluded domains: {excluded_domains}")
    logger.info(f"Region: {region}")

    region_object = region if isinstance(region, dict) else None
    modified_query = prepare_query_for_region(query, region_object)

    google_query = build_exclusion_query(
        modified_query, excluded_domains, "google"
    )
    yandex_query = modified_query

    logger.info(f"Original query: {query}")
    logger.info(f"Modified query for search: {modified_query}")

    google_task = parse_google(
        query=google_query,
        elements=elements,
        region=region
        if isinstance(region, str)
        else region.get("googleCode", "ru"),
        user_id=user_id,
        token=google_search_api,
        cust=google_search_id,
    )

    region_code = get_yandex_region_code(region)
    logger.info(f"Yandex search with region: {region} -> code: {region_code}")

    yandex_task = yandex_fetch_all(
        key_file=yandex_key_file,
        folder_id=yandex_folder_id,
        user_id=user_id,
        query=yandex_query,
        total_results=elements,
        region=region_code,
    )

    tasks = [task for task in [google_task, yandex_task]]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    combined: list[dict] = []
    for res in results:
        if res and not isinstance(res, Exception) and isinstance(res, list):
            combined.extend(res)

    if not combined:
        logger.warning("No results from any engine; returning empty list.")
        return []

    seen = set()
    unique_results: list[dict] = []
    for item in combined:
        link = item.get("domain", "")
        norm = normalize_link(link)
        if norm not in seen:
            seen.add(norm)
            unique_results.append(item)
        else:
            logger.debug(f"Duplicate skipped: {link}")

    filtered_results: list[dict] = []
    excluded_count = 0

    for item in unique_results:
        domain = item.get("domain", "")
        clean_domain = (
            domain.replace("https://", "")
            .replace("http://", "")
            .replace("www.", "")
            .split("/")[0]
        )

        is_excluded = False
        for excluded_domain in excluded_domains:
            excluded_clean = (
                excluded_domain.replace("https://", "")
                .replace("http://", "")
                .replace("www.", "")
            )
            if clean_domain == excluded_clean or clean_domain.endswith(
                "." + excluded_clean
            ):
                is_excluded = True
                excluded_count += 1
                logger.info(
                    f"Excluded domain from results: {domain} (matches {excluded_domain})"
                )
                break

        if not is_excluded:
            filtered_results.append(item)

    logger.info(
        f"Post-filtering: {len(filtered_results)} results after excluding {excluded_count} domains"
    )
    logger.info(
        f"Final results: {len(filtered_results)} unique out of {len(combined)} total"
    )

    return filtered_results
