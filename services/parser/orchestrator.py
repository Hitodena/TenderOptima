"""
Orchestrator — wires search + contact scraping into a single pipeline.
"""

import os
import re
import time
from datetime import datetime

from dotenv import load_dotenv
from loguru import logger

from search_manager import fetch_all
from site_contact_scrapper import get_info

load_dotenv()

CONCURRENT = int(os.getenv("LIMIT_CONCURRENT", "50"))

# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

_EMOJI_RE = re.compile(
    "["
    "\U0001f300-\U0001f9ff"
    "\U0001fa00-\U0001faff"
    "\U00002600-\U000027bf"
    "\U0001f018-\U0001f270"
    "]+",
    flags=re.UNICODE,
)

# Single-character specials that aren't caught by the range above
_SPECIAL_CHARS = frozenset(
    "✅❌✔✓✗✘➦➤➜➝➞➟➠➡➢➣➥➧➨➩➪➫➬➭➮➯➰➱➲➳➴➵➶➷➸➹➺➻➼➽➾➿"
    "⭐🌟💫✨🔥💯🎯📌📍🔍🔎💡⚡🎉🎊🏆🥇🥈🥉💪👍👎"
)


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = _EMOJI_RE.sub("", text)
    text = "".join(ch for ch in text if ch not in _SPECIAL_CHARS)
    return re.sub(r"\s+", " ", text).strip()


def normalize_domain(value: str) -> str:
    """
    Strip scheme, www, and trailing slash for domain-level deduplication.
    """
    if not value:
        return ""
    cleaned = value.strip()
    for prefix in ("https://", "http://"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :]
            break
    if cleaned.startswith("www."):
        cleaned = cleaned[4:]
    return cleaned.rstrip("/")


# ---------------------------------------------------------------------------
# Email relevance filter
# ---------------------------------------------------------------------------

_TECHNICAL_DOMAIN_FRAGMENTS = frozenset(
    [
        "receive-sentry",
        "sentry",
        "noreply",
        "no-reply",
        "donotreply",
        "mailer-daemon",
        "postmaster",
        "automated",
        "system",
        "prom-errors",
        "errors",
        "error",
        "evorun",
        "evo.run",
        "evo",
        "prom",
    ]
)

_HEX_CHARS = frozenset("0123456789abcdef")


def is_relevant_email(address: str) -> bool:
    """
    Return True for email addresses that look like real business contacts.
    Filters out system/transactional/hash-like addresses.
    """
    if not address:
        return False

    parts = address.split("@")
    if len(parts) != 2:
        return False

    local, domain_part = parts[0].lower(), parts[1].lower()

    # Technical sender domains
    if any(frag in domain_part for frag in _TECHNICAL_DOMAIN_FRAGMENTS):
        logger.debug("Technical domain filtered", email=address)
        return False

    # Too many digits total
    if sum(ch.isdigit() for ch in address) > 10:
        logger.debug("Too many digits filtered", email=address)
        return False

    # Long local part + many digits
    if len(local) >= 16 and sum(ch.isdigit() for ch in local) >= 6:
        logger.debug("Long local part with digits filtered", email=address)
        return False

    # Very long local part
    if len(local) >= 30:
        logger.debug("Very long local part filtered", email=address)
        return False

    # Hex-like hash (UUIDs, tokens, etc.)
    cleaned_local = local.replace("-", "").replace("_", "")
    if len(cleaned_local) >= 20:
        hex_ratio = sum(1 for ch in cleaned_local if ch in _HEX_CHARS) / len(
            cleaned_local
        )
        if hex_ratio >= 0.85:
            logger.debug(
                "Hex-like local filtered", ratio=hex_ratio, email=address
            )
            return False

    return True


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


async def main_search(
    query: str,
    elements: int,
    region_name: str,
    yandex_api_key: str,
    yandex_folder_id: str,
    user_id: str,
    excluded_domains: list[str],
) -> list[dict]:
    """
    Full pipeline: Yandex search → contact scraping → enrichment → filtering.

    Args:
        query:             Search query.
        elements:          Max results to fetch.
        region_name:       Region name (ISO-2 or Yandex region name).
        yandex_api_key:    Yandex Cloud Api-Key.
        yandex_folder_id:  Yandex Cloud folder ID.
        user_id:           Caller identifier.
        excluded_domains:  Domains to drop before scraping.

    Returns:
        Enriched supplier dicts that have at least one relevant email.
    """
    start_time = time.perf_counter()
    logger.info(
        "Pipeline start",
        query=query,
        elements=elements,
        user_id=user_id,
        excluded_domains=len(excluded_domains),
    )

    # ── 1. Search ─────────────────────────────────────────────────────────
    try:
        search_results = await fetch_all(
            query=query,
            user_id=user_id,
            elements=elements,
            region_name=region_name,
            yandex_api_key=yandex_api_key,
            yandex_folder_id=yandex_folder_id,
            excluded_domains=excluded_domains,
        )
    except Exception:
        logger.exception("Search stage failed")
        return []

    if not search_results:
        logger.warning("No search results, aborting")
        return []

    logger.info("Search complete", found_domains=len(search_results))

    # ── 2. Contact scraping ───────────────────────────────────────────────
    domains = [r["domain"] for r in search_results]
    try:
        contact_results = await get_info(domains, CONCURRENT)
    except Exception:
        logger.exception("Contact scraping stage failed")
        contact_results = []

    logger.info(
        "Scraping complete",
        with_contacts=len(contact_results),
        total_domains=len(domains),
    )

    # ── 3. Merge ──────────────────────────────────────────────────────────
    contact_map: dict[str, dict] = {
        normalize_domain(r["domain"]): r for r in contact_results
    }

    enriched: list[dict] = []
    now_iso = datetime.now().isoformat()

    for sr in search_results:
        domain = sr["domain"]
        contact = contact_map.get(normalize_domain(domain), {})

        raw_emails: list[str] = contact.get("emails", [])
        if not raw_emails:
            logger.debug("No emails", domain=domain)
            continue

        # Filter out technical/hash emails
        emails = [e for e in raw_emails if is_relevant_email(e)]
        if not emails:
            logger.info(
                "All emails filtered",
                domain=domain,
                raw_emails=raw_emails,
            )
            continue

        phones: list[str] = contact.get("phones", [])

        page_title = clean_text(contact.get("page_title", ""))
        description = clean_text(sr.get("description", ""))

        parts = [p for p in [page_title, description] if p]
        final_description = ". ".join(parts)
        if len(final_description) > 800:
            final_description = (
                final_description[:800].rsplit(" ", 1)[0] + "..."
            )

        enriched.append(
            {
                "user_id": sr["user_id"],
                "query": sr["query"],
                "domain": domain,
                "description": final_description,
                "engine": sr["engine"],
                "emails": emails,
                "phones": phones,
                "dateOfSearch": now_iso,
                "page_title": page_title,
            }
        )
        logger.info(
            "Added",
            domain=domain,
            emails=emails,
            phones=phones,
        )

    execution_time = time.perf_counter() - start_time
    logger.info(
        "Pipeline done",
        enriched=len(enriched),
        total=len(search_results),
        execution_time=f"{execution_time:.2f}",
    )
    return enriched
