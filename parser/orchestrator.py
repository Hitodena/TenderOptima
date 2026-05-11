import os
import re
from datetime import datetime
from pathlib import Path
from typing import Union

from dotenv import load_dotenv
from loguru import logger

from .search_manager import fetch_all
from .site_contact_scrapper import get_info

load_dotenv()

CONCURRENT = int(os.getenv("LIMIT_CONCURRENT", 50))


def normalize_domain(value: str) -> str:
    """
    Normalize domains/URLs so that `https://www.example.com/` and `example.com`
    are considered equal when we match contact info back to search results.
    """
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.startswith("http://"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("https://"):
        cleaned = cleaned[8:]
    if cleaned.startswith("www."):
        cleaned = cleaned[4:]
    return cleaned.rstrip("/")


def clean_text(text: str) -> str:
    """
    Remove emoji from text
    """
    if not text:
        return ""

    emoji_pattern = re.compile(
        "["
        "\U0001f600-\U0001f64f"
        "\U0001f300-\U0001f5ff"
        "\U0001f680-\U0001f6ff"
        "\U0001f1e0-\U0001f1ff"
        "\U00002702-\U000027b0"
        "\U000024c2-\U0001f251"
        "\U0001f900-\U0001f9ff"
        "\U0001fa00-\U0001fa6f"
        "\U0001fa70-\U0001faff"
        "\U00002600-\U000026ff"
        "\U00002700-\U000027bf"
        "\U0001f018-\U0001f270"
        "\U0001f300-\U0001f5ff"
        "\U0001f600-\U0001f64f"
        "\U0001f680-\U0001f6ff"
        "\U0001f700-\U0001f77f"
        "\U0001f780-\U0001f7ff"
        "\U0001f800-\U0001f8ff"
        "\U0001f900-\U0001f9ff"
        "\U0001fa00-\U0001fa6f"
        "\U0001fa70-\U0001faff"
        "\U00002600-\U000026ff"
        "\U00002700-\U000027bf"
        "]+",
        flags=re.UNICODE,
    )

    text = emoji_pattern.sub("", text)

    special_chars = [
        "✅",
        "❌",
        "✔",
        "✓",
        "✗",
        "✘",
        "➦",
        "➤",
        "➜",
        "➝",
        "➞",
        "➟",
        "➠",
        "➡",
        "➢",
        "➣",
        "➥",
        "➧",
        "➨",
        "➩",
        "➪",
        "➫",
        "➬",
        "➭",
        "➮",
        "➯",
        "➰",
        "➱",
        "➲",
        "➳",
        "➴",
        "➵",
        "➶",
        "➷",
        "➸",
        "➹",
        "➺",
        "➻",
        "➼",
        "➽",
        "➾",
        "➿",
        "⭐",
        "🌟",
        "💫",
        "✨",
        "🔥",
        "💯",
        "🎯",
        "📌",
        "📍",
        "🔍",
        "🔎",
        "💡",
        "⚡",
        "🎉",
        "🎊",
        "🏆",
        "🥇",
        "🥈",
        "🥉",
        "💪",
        "👍",
        "👎",
        "❤",
        "💛",
        "💚",
        "💙",
        "💜",
        "🖤",
        "🤍",
        "🤎",
        "💔",
        "❣",
        "💕",
        "💞",
        "💓",
        "💗",
        "💖",
        "💘",
        "💝",
        "💟",
        "☀",
        "☁",
        "☂",
        "☃",
        "☄",
        "★",
        "☆",
        "☇",
        "☈",
        "☉",
        "☊",
        "☋",
        "☌",
        "☍",
        "☎",
        "☏",
        "☐",
        "☑",
        "☒",
        "☓",
        "☔",
        "☕",
        "☖",
        "☗",
        "☘",
        "☙",
        "☚",
        "☛",
        "☜",
        "☝",
        "☞",
        "☟",
        "☠",
        "☡",
        "☢",
        "☣",
        "☤",
        "☥",
        "☦",
        "☧",
        "☨",
        "☩",
        "☪",
        "☫",
        "☬",
        "☭",
        "☮",
        "☯",
        "☰",
        "☱",
        "☲",
        "☳",
        "☴",
        "☵",
        "☶",
        "☷",
        "☸",
        "☹",
        "☺",
        "☻",
        "☼",
        "☽",
        "☾",
        "☿",
        "♀",
        "♁",
        "♂",
        "♃",
        "♄",
        "♅",
        "♆",
        "♇",
        "♈",
        "♉",
        "♊",
        "♋",
        "♌",
        "♍",
        "♎",
        "♏",
        "♐",
        "♑",
        "♒",
        "♓",
        "♔",
        "♕",
        "♖",
        "♗",
        "♘",
        "♙",
        "♚",
        "♛",
        "♜",
        "♝",
        "♞",
        "♟",
        "♠",
        "♡",
        "♢",
        "♣",
        "♤",
        "♥",
        "♦",
        "♧",
        "♨",
        "♩",
        "♪",
        "♫",
        "♬",
        "♭",
        "♮",
        "♯",
        "♰",
        "♱",
        "♲",
        "♳",
        "♴",
        "♵",
        "♶",
        "♷",
        "♸",
        "♹",
        "♺",
        "♻",
        "♼",
        "♽",
        "♾",
        "♿",
        "⚀",
        "⚁",
        "⚂",
        "⚃",
        "⚄",
        "⚅",
        "⚆",
        "⚇",
        "⚈",
        "⚉",
        "⚊",
        "⚋",
        "⚌",
        "⚍",
        "⚎",
        "⚏",
        "⚐",
        "⚑",
        "⚒",
        "⚓",
        "⚔",
        "⚕",
        "⚖",
        "⚗",
        "⚘",
        "⚙",
        "⚚",
        "⚛",
        "⚜",
        "⚝",
        "⚞",
        "⚟",
        "⚠",
        "⚡",
        "⚢",
        "⚣",
        "⚤",
        "⚥",
        "⚦",
        "⚧",
        "⚨",
        "⚩",
        "⚪",
        "⚫",
        "⚬",
        "⚭",
        "⚮",
        "⚯",
        "⚰",
        "⚱",
        "⚲",
        "⚳",
        "⚴",
        "⚵",
        "⚶",
        "⚷",
        "⚸",
        "⚹",
        "⚺",
        "⚻",
        "⚼",
        "⚽",
        "⚾",
        "⚿",
        "⛀",
        "⛁",
        "⛂",
        "⛃",
        "⛄",
        "⛅",
        "⛆",
        "⛇",
        "⛈",
        "⛉",
        "⛊",
        "⛋",
        "⛌",
        "⛍",
        "⛎",
        "⛏",
        "⛐",
        "⛑",
        "⛒",
        "⛓",
        "⛔",
        "⛕",
        "⛖",
        "⛗",
        "⛘",
        "⛙",
        "⛚",
        "⛛",
        "⛜",
        "⛝",
        "⛞",
        "⛟",
        "⛠",
        "⛡",
        "⛢",
        "⛣",
        "⛤",
        "⛥",
        "⛦",
        "⛧",
        "⛨",
        "⛩",
        "⛪",
        "⛫",
        "⛬",
        "⛭",
        "⛮",
        "⛯",
        "⛰",
        "⛱",
        "⛲",
        "⛳",
        "⛴",
        "⛵",
        "⛶",
        "⛷",
        "⛸",
        "⛹",
        "⛺",
        "⛻",
        "⛼",
        "⛽",
        "⛾",
        "⛿",
    ]

    for char in special_chars:
        text = text.replace(char, "")

    text = re.sub(r"\s+", " ", text)

    return text.strip()


async def main_search(
    query: str,
    elements: int,
    region: Union[str, dict],
    google_search_api: str,
    google_search_id: str,
    yandex_key_file: Path,
    yandex_folder_id: str,
    user_id: str,
    excluded_domains: list[str],
) -> list[dict]:
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
    logger.info(
        f"Starting search for query: '{query}' with {elements} elements, excluding {len(excluded_domains)} domains"
    )

    try:
        search_results = await fetch_all(
            query=query,
            user_id=user_id,
            elements=elements,
            region=region,
            google_search_api=google_search_api,
            google_search_id=google_search_id,
            yandex_key_file=yandex_key_file,
            yandex_folder_id=yandex_folder_id,
            excluded_domains=excluded_domains,
        )

        if not search_results:
            logger.warning("No search results found")
            return []

        logger.info(
            f"Found {len(search_results)} domains from search engines (after query-level exclusions)"
        )

    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []

    # Extract contact information
    try:
        domains = [result["domain"] for result in search_results]

        contact_results = await get_info(domains, CONCURRENT)

        logger.info(f"Extracted contacts from {len(contact_results)} domains")

    except Exception as e:
        logger.error(f"Contact extraction failed: {e}")
        contact_results = []

    enriched_results = []
    contact_map = {
        normalize_domain(result["domain"]): result
        for result in contact_results
    }

    def is_relevant_email(address: str) -> bool:
        if not address:
            return False

        parts = address.split("@")
        if len(parts) != 2:
            return False
        local_part = parts[0].lower()
        domain_part = parts[1].lower()

        technical_domains = [
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

        for tech_domain in technical_domains:
            if tech_domain in domain_part:
                logger.info(
                    f"Filtered email (technical domain '{tech_domain}'): {address}"
                )
                return False

        digits_total = sum(ch.isdigit() for ch in address)
        if digits_total > 10:
            logger.info(
                f"Filtered email (>10 digits: {digits_total}): {address}"
            )
            return False

        digits_local = sum(ch.isdigit() for ch in local_part)
        if len(local_part) >= 16 and digits_local >= 6:
            logger.info(
                f"Filtered email (long local part with >=6 digits): {address}"
            )
            return False

        hex_chars = set("0123456789abcdef")
        cleaned_local = local_part.replace("-", "").replace("_", "")
        if len(cleaned_local) >= 20:
            hex_ratio = sum(
                1 for ch in cleaned_local if ch in hex_chars
            ) / len(cleaned_local)
            if hex_ratio >= 0.85:
                logger.info(
                    f"Filtered email (hex-like technical email, {hex_ratio:.1%} hex): {address}"
                )
                return False

        if len(local_part) >= 30:
            logger.info(
                f"Filtered email (very long local part >=30): {address}"
            )
            return False

        if len(local_part) >= 20:
            if all(ch in hex_chars or ch in "-_" for ch in local_part):
                hex_only = sum(1 for ch in local_part if ch in hex_chars)
                if hex_only >= 20:
                    logger.info(
                        f"Filtered email (long hex-only local part, {hex_only} hex chars): {address}"
                    )
                    return False

        if len(local_part) >= 20:
            has_non_hex = any(
                ch not in hex_chars and ch not in "-_." for ch in local_part
            )
            if not has_non_hex and len(local_part) >= 20:
                logger.info(
                    f"Filtered email (only hex chars, no separators): {address}"
                )
                return False

        digits_local = sum(ch.isdigit() for ch in local_part)
        if len(local_part) >= 16 and digits_local >= 6:
            logger.info(
                f"Filtered email (long local part with >=6 digits): {address}"
            )
            return False

        hex_chars = set("0123456789abcdef")
        cleaned_local = local_part.replace("-", "").replace("_", "")
        if len(cleaned_local) >= 20:
            hex_ratio = sum(
                1 for ch in cleaned_local if ch in hex_chars
            ) / len(cleaned_local)
            if hex_ratio >= 0.85:
                logger.info(
                    f"Filtered email (hex-like technical email, {hex_ratio:.1%} hex): {address}"
                )
                return False

        if len(local_part) >= 30:
            logger.info(
                f"Filtered email (very long local part >=30): {address}"
            )
            return False

        if len(local_part) >= 20:
            if all(ch in hex_chars or ch in "-_" for ch in local_part):
                hex_only = sum(1 for ch in local_part if ch in hex_chars)
                if hex_only >= 20:
                    logger.info(
                        f"Filtered email (long hex-only local part, {hex_only} hex chars): {address}"
                    )
                    return False

        if len(local_part) >= 20:
            has_non_hex = any(
                ch not in hex_chars and ch not in "-_." for ch in local_part
            )
            if not has_non_hex and len(local_part) >= 20:
                logger.info(
                    f"Filtered email (only hex chars, no separators): {address}"
                )
                return False

        return False

    for search_result in search_results:
        domain = search_result["domain"]
        normalized_domain = normalize_domain(domain)
        contact_info = contact_map.get(normalized_domain, {})

        emails = contact_info.get("emails", [])

        if not emails:
            logger.info(
                f"Rejecting {domain} because there is no emails",
            )
            continue

        phones = contact_info.get("phones", [])

        if emails:
            page_title = contact_info.get("page_title", "")
            original_description = search_result.get("description", "")

            page_title = clean_text(page_title) if page_title else ""
            original_description = (
                clean_text(original_description)
                if original_description
                else ""
            )

            description_parts = []

            if page_title:
                description_parts.append(page_title)
            if original_description:
                description_parts.append(original_description)
            if description_parts:
                final_description = ". ".join(description_parts)
            else:
                final_description = page_title or original_description or ""

            if len(final_description) > 800:
                final_description = (
                    final_description[:800].rsplit(" ", 1)[0] + "..."
                )

            enriched_result = {
                "user_id": search_result["user_id"],
                "query": search_result["query"],
                "domain": search_result["domain"],
                "description": final_description,
                "engine": search_result["engine"],
                "emails": emails,
                "phones": phones,
                "dateOfSearch": datetime.now().isoformat(),
                "page_title": page_title,
            }
            enriched_results.append(enriched_result)
            logger.info("Domain '{}' added with emails: {}", domain, emails)

    logger.info(
        f"Final results: {len(enriched_results)} suppliers with authentic contact information"
    )

    return enriched_results
