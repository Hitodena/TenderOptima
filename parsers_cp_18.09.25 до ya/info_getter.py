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
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def sanitize_url(domain: str) -> str:
    """
    Ensure domain has scheme; if missing, default to https.
    """
    if not domain.startswith(("http://", "https://")):
        return f"https://{domain}"
    return domain


def is_valid_email(addr: str) -> bool:
    """
    Syntactic-only email validation using email-validator without DNS lookups.
    """
    try:
        validation = validate_email(addr, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


async def find_contact_page(session: aiohttp.ClientSession, domain: str) -> str:
    base_url = sanitize_url(domain)
    for path in CONTACT_PATHS:
        url = base_url + path
        try:
            async with session.head(url, timeout=aiohttp.ClientTimeout(2)) as response:
                logger.debug(f"HEAD {url} -> {response.status}")
                if response.status == 200:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(2)) as get_resp:
                        text = await get_resp.text(errors="ignore")
                        if "mailto:" in text or "tel:" in text:
                            return url
        except Exception:
            continue

    return base_url


def normalize_email(raw: str) -> str:
    return raw.split(":", 1)[-1].strip().lower()


def extract_contacts(html: str, region: str) -> Optional[Dict[str, List[str]]]:
    tree = HTMLParser(html)
    text = tree.text(separator=" ")

    emails = set()
    phones = set()

    links_email = tree.css('a[href^="mailto:"]')
    if links_email is None:
        return None

    for link in links_email:
        if link.attributes["href"] and ":" in link.attributes["href"]:
            email = normalize_email(link.attributes["href"])
            if is_valid_email(email):
                emails.add(email)

    for email in EMAIL_RE.findall(text):
        if is_valid_email(email):
            emails.add(email.lower())

    links_phones = tree.css('a[href^="tel:"]')

    for link in links_phones:
        phone = link.attributes["href"]
        if not phone:
            continue

        phone_raw = phone.split(":", 1)[-1]
        try:
            default_region = None if phone_raw.startswith("+") else region.upper()
            num = phonenumbers.parse(phone_raw, default_region)
            if phonenumbers.is_valid_number(num):
                formatted = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
                phones.add(formatted)
        except Exception:
            continue

    for phone_raw in re.findall(r"\+?\d[\d\-\s\(\)]{5,}\d", text):
        try:
            default_region = None if phone_raw.startswith("+") else region.upper()
            num = phonenumbers.parse(phone_raw, default_region)
            if phonenumbers.is_valid_number(num):
                phones.add(phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164))
        except Exception:
            continue

    return {"emails": sorted(emails), "phones": sorted(phones)}


async def fetch_contacts(
    domain: str, session: aiohttp.ClientSession, semaphore: asyncio.Semaphore
) -> Optional[Dict[str, Union[str, List]]]:
    async with semaphore:
        contact_url = await find_contact_page(session, domain)
        try:
            async with session.get(contact_url) as response:
                html = await response.text(errors="ignore")
        except Exception:
            return {"url": contact_url, "emails": [], "phones": []}

    data = extract_contacts(html, "ru")
    if data:
        if not data.get("emails"):
            return None

        return {"url": contact_url, **data}

    return {"url": contact_url, "emails": [], "phones": []}


async def get_info(
    domains: List[str], semaphore: asyncio.Semaphore, connector: aiohttp.TCPConnector
) -> List[Dict[str, Union[str, List]]]:
    ua = UserAgent()
    headers = {"User-Agent": ua.random}
    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        tasks = [fetch_contacts(domain, session, semaphore) for domain in domains]
        results = await asyncio.gather(*tasks)

    filtered = [r for r in results if r]
    logger.info(f"Completed contact extraction: {len(filtered)} domains with emails")
    return filtered