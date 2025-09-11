
import asyncio
import re
from typing import Dict, List, Optional, Union

import aiohttp
import phonenumbers
from email_validator import EmailNotValidError, validate_email
from fake_useragent import UserAgent
from selectolax.parser import HTMLParser

from .utils.logger import CustomLogger

logger = CustomLogger(
    "ContactInfoGetter", "ContactInfoGetter.log", debug=False, console=True
).get_logger()

CONTACT_PATHS = ["/contact", "/contacts", "/контакты", "/about", "/о-компании"]
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def sanitize_url(domain: str) -> str:
    """
    Ensure domain has scheme; if missing, default to https.
    """
    if not domain.startswith(("http://", "https://")):
        return f"https://{domain}"
    return domain


def is_valid_email(addr: str) -> bool:
    """
    Validate email address using email-validator.
    """
    try:
        validate_email(addr, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def normalize_email(raw_email: str) -> str:
    """Очищает email от префиксов и лишних символов."""
    if raw_email.lower().startswith('mailto:'):
        email_part = raw_email.split(":", 1)[-1]
    else:
        email_part = raw_email
    return email_part.strip().lower()


def extract_contacts(html: str, region: str) -> Optional[Dict[str, List[str]]]:
    """
    Extract emails and phone numbers from HTML content.
    """
    tree = HTMLParser(html)
    text = tree.text(separator=" ")
    emails = set()
    phones = set()

    # Extract emails from text
    for potential_email in EMAIL_RE.findall(text):
        normalized = normalize_email(potential_email)
        if is_valid_email(normalized):
            emails.add(normalized)

    # Extract emails from mailto links
    for link in tree.css('a[href^="mailto:"]'):
        raw_href = link.attributes.get("href")
        if raw_href:
            normalized = normalize_email(raw_href)
            if is_valid_email(normalized):
                emails.add(normalized)

    # Extract phone numbers
    for phone_raw in re.findall(r"\+?\d[\d\-\s\(\)]{8,}\d", text):
        try:
            default_region = None if phone_raw.strip().startswith("+") else region.upper()
            num = phonenumbers.parse(phone_raw, default_region)
            if phonenumbers.is_valid_number(num):
                phones.add(phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164))
        except Exception:
            continue

    if not emails and not phones:
        return None

    return {"emails": sorted(list(emails)), "phones": sorted(list(phones))}


async def fetch_contacts(
    domain: str,
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    region: str
) -> Optional[Dict[str, Union[str, List]]]:
    """
    Fetch contact information from a domain.
    """
    async with semaphore:
        base_url = sanitize_url(domain)
        
        # Step 1: Try main page
        try:
            async with session.get(base_url, timeout=aiohttp.ClientTimeout(11)) as response:
                if response.status == 200:
                    html = await response.text(errors="ignore")
                    data = extract_contacts(html, region)
                    if data and data.get("emails"):
                        return {"url": base_url, **data}
        except Exception as e:
            logger.warning(f"Failed to fetch {base_url}: {e}")

        # Step 2: Try contact pages if main page didn't have contacts
        for path in CONTACT_PATHS:
            contact_url = base_url.rstrip("/") + path
            try:
                async with session.get(contact_url, timeout=aiohttp.ClientTimeout(11)) as response:
                    if response.status == 200:
                        html = await response.text(errors="ignore")
                        data = extract_contacts(html, region)
                        if data and data.get("emails"):
                            return {"url": contact_url, **data}
            except Exception:
                continue

        return None


async def get_info(
    domains: List[str],
    semaphore: asyncio.Semaphore,
    connector: aiohttp.TCPConnector,
    region: str
) -> List[Dict[str, Union[str, List]]]:
    """
    Extract contact information from a list of domains.
    """
    ua = UserAgent()
    headers = {"User-Agent": ua.random}

    ssl_connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=ssl_connector, headers=headers) as session:
        tasks = [fetch_contacts(domain, session, semaphore, region) for domain in domains]
        results = await asyncio.gather(*tasks)

        filtered = [r for r in results if r]
        logger.info(f"Completed contact extraction: {len(filtered)} domains with contacts found.")
        return filtered
