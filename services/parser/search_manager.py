"""
Search manager — Yandex only.
Handles region normalisation, query modification, deduplication, and domain exclusion.
"""

from urllib.parse import urlparse, urlunparse

from loguru import logger

from yandex_parser import yandex_fetch_all

_REGION_MAP: dict[str, int] = {
    "ru": 225,
    "by": 149,
    "kk": 159,
    "kz": 159,
    "uz": 191,
    "tr": 225,
    "com": 225,
}


def _get_search_type(region_code: int) -> str:
    if region_code == 149:
        return "SEARCH_TYPE_BE"
    if region_code == 159:
        return "SEARCH_TYPE_KK"
    if region_code == 191:
        return "SEARCH_TYPE_UZ"
    if region_code == 225:
        return "SEARCH_TYPE_RU"
    return "SEARCH_TYPE_COM"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_link(link: str) -> str:
    """Lowercase scheme/netloc, strip trailing slash, drop query & fragment."""
    parsed = urlparse(link)
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    return urlunparse((scheme, netloc, path, "", "", ""))


def _clean_domain(raw: str) -> str:
    """Strip scheme, www, and path — return bare hostname."""
    return (
        raw.replace("https://", "")
        .replace("http://", "")
        .replace("www.", "")
        .split("/")[0]
        .lower()
    )


def _add_city_to_queries(query: str, city: str) -> str:
    """
    Append city name to every comma-separated sub-query.
    "купить стулья, стулья оптом" + "Минск" → "купить стулья Минск, стулья оптом Минск"
    """
    parts = [q.lower().strip() for q in query.split(",") if q.strip()]
    return ", ".join(f"{q} {city.lower()}" for q in parts)


def _prepare_query(query: str, region_name: str) -> str:
    if not region_name:
        return query
    modified = _add_city_to_queries(query, region_name)
    logger.info(
        "Query city-modified",
        query=query,
        modified=modified,
    )
    return modified


def _resolve_region(region: str | int | dict) -> tuple[int, str]:
    """
    Resolve region to (region_id, region_name).

    Args:
        region: ISO-2 string, Yandex region int, or region dict.

    Returns:
        Tuple of (region_id, region_name).
    """
    region_name = ""
    if isinstance(region, int):
        return region, ""
    if isinstance(region, str):
        region_name = region
        code = _REGION_MAP.get(region.lower())
        if code is None:
            logger.warning(
                "Unknown region string, defaulting to 225 (RU)",
                region=region,
            )
            return 225, region_name
        return code, region_name
    if isinstance(region, dict):
        yid = region.get("yandexId") or region.get("yandex_id")
        if yid:
            return int(yid), ""
        iso = region.get("googleCode") or region.get("iso", "")
        if iso:
            region_name = iso
            return _REGION_MAP.get(iso.lower(), 225), region_name
    return 225, region_name


def _is_excluded(domain_raw: str, excluded: list[str]) -> bool:
    clean = _clean_domain(domain_raw)
    for ex in excluded:
        ex_clean = _clean_domain(ex)
        if clean == ex_clean or clean.endswith("." + ex_clean):
            return True
    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def fetch_all(
    query: str,
    user_id: str,
    elements: int,
    region_name: str,
    yandex_api_key: str,
    yandex_folder_id: str,
    excluded_domains: list[str] | None = None,
) -> list[dict]:
    """
    Run Yandex search, deduplicate by normalised URL, filter excluded domains.

    Args:
        query:             Raw search query from caller.
        user_id:           Caller identifier propagated to results.
        elements:          Max result count.
        region_name:       Region name (ISO-2 or Yandex region name).
        yandex_api_key:    Yandex Cloud Api-Key.
        yandex_folder_id:  Yandex Cloud folder ID.
        excluded_domains:  Domains to drop from results.

    Returns:
        Deduplicated, filtered list of result dicts.
    """
    excluded_domains = excluded_domains or []

    # region_code, resolved_name = _resolve_region(region_name)
    modified_query = _prepare_query(query, region_name)
    # search_type = _get_search_type(region_code)

    logger.info(
        "Search start",
        query=query,
        modified_query=modified_query,
        elements=elements,
        region=region_name,
        excluded_domains=len(excluded_domains),
    )

    raw_results = await yandex_fetch_all(
        api_key=yandex_api_key,
        folder_id=yandex_folder_id,
        user_id=user_id,
        query=modified_query,
        total_results=elements,
    )

    if not raw_results:
        logger.warning("Yandex returned no results")
        return []

    # Deduplicate by normalised URL
    seen: set[str] = set()
    unique: list[dict] = []
    for item in raw_results:
        norm = _normalize_link(item.get("domain", ""))
        if norm not in seen:
            seen.add(norm)
            unique.append(item)
        else:
            logger.debug(
                "Duplicate skipped",
                domain=item.get("domain"),
            )

    # Filter excluded domains
    filtered: list[dict] = []
    excluded_count = 0
    for item in unique:
        domain = item.get("domain", "")
        if _is_excluded(domain, excluded_domains):
            excluded_count += 1
            logger.debug(
                "Excluded",
                domain=item.get("domain"),
            )
        else:
            filtered.append(item)

    logger.info(
        "Search done",
        raw=len(raw_results),
        unique=len(unique),
        excluded=excluded_count,
        final=len(filtered),
    )
    return filtered
