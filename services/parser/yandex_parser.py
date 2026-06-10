"""
Yandex Search API v2 — async web search via Api-Key auth.
No service account files, no JWT, no IAM token exchange.
"""

import asyncio
import base64
import math
import xml.etree.ElementTree as ET

import aiohttp
from loguru import logger

API_URL_POST = "https://searchapi.api.cloud.yandex.net/v2/web/searchAsync"
API_URL_GET = "https://operation.api.cloud.yandex.net/operations/{}"

POLL_INTERVAL = 5  # seconds between polls
MAX_RETRIES = 5
RETRY_DELAY = 10  # seconds between retry attempts
REQUEST_TIMEOUT = 30  # seconds per HTTP call
POLL_TIMEOUT = 15  # seconds per poll call


def _auth_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Api-Key {api_key}",
        "Content-Type": "application/json",
    }


async def post_search(
    session: aiohttp.ClientSession,
    api_key: str,
    query: str,
    page: int,
    folder_id: str,
    groups_on_page: int,
    docs_in_group: int,
    region_id: int = 149,
    search_type: str = "SEARCH_TYPE_BY",
) -> str | None:
    """
    Submit an async Yandex search operation.
    Returns the operation ID, or None on failure.
    """
    body = {
        "query": {
            "searchType": search_type,
            "queryText": query,
            "familyMode": "FAMILY_MODE_NONE",
            "page": str(page),
        },
        "sortSpec": {
            "sortMode": "SORT_MODE_BY_RELEVANCE",
            "sortOrder": "SORT_ORDER_DESC",
        },
        "groupSpec": {
            "groupMode": "GROUP_MODE_DEEP",
            "groupsOnPage": str(groups_on_page),
            "docsInGroup": str(docs_in_group),
        },
        "maxPassages": "5",
        "region": str(region_id),
        "l10N": "LOCALIZATION_RU",
        "folderId": folder_id,
        "responseFormat": "FORMAT_XML",
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.debug(
                "POST search",
                attempt=attempt,
                page=page,
                query=query,
            )
            async with session.post(
                API_URL_POST,
                json=body,
                headers=_auth_headers(api_key),
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
            ) as resp:
                raw = await resp.text()
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    op_id: str = data.get("id", "")
                    logger.info(
                        "Operation submitted",
                        op_id=op_id,
                        page=page,
                    )
                    return op_id
                logger.warning(
                    "POST failed",
                    status=resp.status,
                    page=page,
                    body=raw[:300],
                )
        except TimeoutError:
            logger.warning(
                "POST timeout",
                attempt=attempt,
                page=page,
            )
        except aiohttp.ClientError as exc:
            logger.error(
                "POST client error",
                attempt=attempt,
                page=page,
                error=exc,
            )
        except Exception:
            logger.exception(
                "POST unexpected error",
                attempt=attempt,
                page=page,
            )

        if attempt < MAX_RETRIES:
            await asyncio.sleep(RETRY_DELAY)

    logger.error(
        "POST gave up after retries",
        max_retries=MAX_RETRIES,
        page=page,
    )
    return None


async def poll_search(
    session: aiohttp.ClientSession,
    api_key: str,
    op_id: str,
) -> dict | None:
    """
    Poll until operation is done. Returns the full operation JSON or None.
    """
    url = API_URL_GET.format(op_id)

    for attempt in range(1, MAX_RETRIES + 1):
        await asyncio.sleep(POLL_INTERVAL)
        try:
            logger.debug(
                "Poll operation",
                attempt=attempt,
                op_id=op_id,
            )
            async with session.get(
                url,
                headers=_auth_headers(api_key),
                timeout=aiohttp.ClientTimeout(total=POLL_TIMEOUT),
            ) as resp:
                if resp.status != 200:
                    raw = await resp.text()
                    logger.warning(
                        "Poll non-200",
                        status=resp.status,
                        op_id=op_id,
                        body=raw[:300],
                    )
                else:
                    data = await resp.json(content_type=None)
                    if data.get("done"):
                        logger.info("Operation complete", op_id=op_id)
                        return data
                    logger.debug(
                        "Operation not done yet",
                        op_id=op_id,
                        attempt=attempt,
                    )
        except TimeoutError:
            logger.warning(
                "Poll timeout",
                op_id=op_id,
                attempt=attempt,
            )
        except aiohttp.ClientError as exc:
            logger.error(
                "Poll client error",
                op_id=op_id,
                attempt=attempt,
                error=exc,
            )
        except Exception:
            logger.exception(
                "Poll unexpected error",
                op_id=op_id,
                attempt=attempt,
            )

        if attempt < MAX_RETRIES:
            await asyncio.sleep(RETRY_DELAY)

    logger.error(
        "Poll gave up after retries",
        max_retries=MAX_RETRIES,
        op_id=op_id,
    )
    return None


def parse_yandex_xml(xml_str: str) -> list[dict]:
    """
    Parse Yandex XML response into a list of {domain, description} dicts.
    """
    try:
        root = ET.fromstring(xml_str)
    except ET.ParseError as exc:
        logger.error("XML parse error", error=exc)
        return []

    seen: set[str] = set()
    out: list[dict] = []

    for group in root.findall(".//results/grouping/group"):
        categ = group.find("categ")
        if categ is None:
            continue

        domain = categ.get("name", "").lower().removeprefix("www.")
        if not domain or domain in seen:
            continue

        seen.add(domain)
        snippet: str | None = None
        doc = group.find("doc")
        if doc is not None:
            passage = doc.find("passages/passage")
            if passage is not None:
                snippet = "".join(passage.itertext()).strip() or None

        out.append({"domain": domain, "description": snippet})

    logger.debug("XML parsed", unique_domains=len(out))
    return out


async def yandex_fetch_all(
    api_key: str,
    folder_id: str,
    user_id: str,
    query: str,
    total_results: int,
    groups_on_page: int = 100,
    docs_in_group: int = 1,
    region_id: int = 149,
    search_type: str = "SEARCH_TYPE_BE",
) -> list[dict]:
    """
    Fetch up to `total_results` unique domains from Yandex Web Search.

    Args:
        api_key:       Yandex Cloud Api-Key token.
        folder_id:     Yandex Cloud folder ID.
        user_id:       Caller identifier, propagated to results.
        query:         Search query string.
        total_results: Max domains to collect.
        groups_on_page: Domains per page (max 100).
        docs_in_group:  Documents per domain group.
        region:        Yandex region code (default 225 = RU).
        search_type:   Yandex search type (default SEARCH_TYPE_RU).

    Returns:
        List of result dicts with keys: user_id, query, region, domain,
        description, engine.
    """
    max_per_page = groups_on_page * docs_in_group
    pages_needed = math.ceil(total_results / max_per_page)
    seen: set[str] = set()
    combined: list[dict] = []

    logger.info(
        "Fetch start",
        query=query,
        want=total_results,
        pages=pages_needed,
        region=region_id,
        search_type=search_type,
    )

    async with aiohttp.ClientSession() as session:
        for page in range(pages_needed):
            op_id = await post_search(
                session,
                api_key,
                query,
                page,
                folder_id,
                groups_on_page,
                docs_in_group,
                region_id,
                search_type,
            )
            if not op_id:
                logger.warning(
                    "No operation ID, aborting pagination",
                    page=page,
                )
                break

            op_data = await poll_search(session, api_key, op_id)
            if not op_data:
                logger.warning(
                    "No poll result, aborting pagination",
                    op_id=op_id,
                )
                break

            try:
                raw_b64: str = op_data["response"]["rawData"]
                xml_text = base64.b64decode(raw_b64).decode("utf-8")
            except (KeyError, ValueError) as exc:
                logger.error(
                    "Failed to decode rawData",
                    page=page,
                    error=exc,
                )
                break

            page_items = parse_yandex_xml(xml_text)
            added = 0
            for item in page_items:
                dom = item["domain"]
                if dom in seen:
                    continue
                seen.add(dom)
                combined.append(
                    {
                        "user_id": user_id,
                        "query": query,
                        "region": str(region_id),
                        "domain": dom,
                        "description": item["description"],
                        "engine": "yandex",
                    }
                )
                added += 1
                if len(combined) >= total_results:
                    break

            logger.info(
                "Page done",
                page=page,
                added=added,
                collected=len(combined),
                total=total_results,
            )

            if len(combined) >= total_results:
                break

    logger.info("Fetch complete", collected=len(combined))
    return combined
