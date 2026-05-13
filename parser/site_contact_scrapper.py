import asyncio
import codecs
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlparse

import aiohttp
import phonenumbers
from aiohttp import ClientTimeout
from email_validator import EmailNotValidError, validate_email
from fake_useragent import UserAgent
from loguru import logger
from selectolax.parser import HTMLParser

CONTACT_PATHS = [
    "/contact",
    "/contacts",
    "/kontakty",
    "/kontakti",
    "/контакты",
    "/about",
    "/о-компании",
    "/feedback",
    "/impressum",
    "/legal",
]
CONTACT_KEYWORDS = [
    "contact",
    "contacts",
    "kontakti",
    "about",
    "impressum",
    "legal",
    "kontakty",
    "о-нас",
    "связаться",
    "feedback",
]
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
HOSTCMS_EMAIL_PATTERN = re.compile(
    r"hostcmsEmail\(['\"]([^'\"]+)['\"]\)", re.IGNORECASE | re.DOTALL
)
ROT13_MAILTO_PATTERN = re.compile(r"znvygb:([a-z0-9._%+\-@]+)", re.IGNORECASE)
CFEMAIL_PATTERN = re.compile(r'data-cfemail="([0-9a-fA-F]+)"')


def sanitize_url(domain: str) -> str:
    if not re.match(r"^(http|https)://", domain):
        return f"https://{domain}"
    return domain


def is_valid_email(addr: str) -> bool:
    try:
        validate_email(addr, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


async def fetch_and_parse_sitemap(
    session: aiohttp.ClientSession, sitemap_url: str, processed_sitemaps: set
) -> list[str]:
    if sitemap_url in processed_sitemaps:
        return []
    processed_sitemaps.add(sitemap_url)
    logger.debug(f"Parsing sitemap: {sitemap_url}")
    urls = []
    try:
        async with session.get(
            sitemap_url, timeout=ClientTimeout(total=10)
        ) as response:
            if response.status != 200:
                return []
            root = ET.fromstring(await response.read())
            if root.tag.endswith("sitemapindex"):
                sitemap_locs = [
                    loc.text or ""
                    for s in root.findall("{*}sitemap")
                    if (loc_elem := s.find("{*}loc"))
                    and loc_elem is not None
                    and loc_elem.text
                    for loc in [loc_elem]
                ]
                tasks = [
                    fetch_and_parse_sitemap(session, loc, processed_sitemaps)
                    for loc in sitemap_locs
                ]
                for result in await asyncio.gather(*tasks):
                    urls.extend(result)
            elif root.tag.endswith("urlset"):
                urls.extend(
                    [
                        loc.text
                        for u in root.findall("{*}url")
                        if (loc_elem := u.find("{*}loc"))
                        and loc_elem is not None
                        and loc_elem.text
                        for loc in [loc_elem]
                    ]
                )
    except Exception as e:
        logger.error(f"Error processing sitemap {sitemap_url}: {e}")
    return urls


async def crawl_for_contact_page(
    session: aiohttp.ClientSession, base_url: str
) -> str | None:
    logger.debug(f"Smart-crawling main page: {base_url}")
    try:
        async with session.get(
            base_url, timeout=ClientTimeout(total=7)
        ) as response:
            if response.status != 200:
                return None
            html = await response.text(errors="ignore")

        tree = HTMLParser(html)
        main_domain = urlparse(base_url).netloc

        for link in tree.css("a[href]"):
            href = (link.attributes.get("href") or "").strip()
            if not href or href.startswith(
                ("#", "mailto:", "tel:", "javascript:")
            ):
                continue

            absolute_url = urljoin(base_url, href)
            if urlparse(absolute_url).netloc != main_domain:
                continue

            link_text = (link.text() + " " + href).lower()
            if any(keyword in link_text for keyword in CONTACT_KEYWORDS):
                try:
                    async with session.head(
                        absolute_url,
                        timeout=ClientTimeout(total=2),
                        allow_redirects=True,
                    ) as head_response:
                        if 200 <= head_response.status < 300:
                            logger.info(
                                f"Found contact page via smart crawler: {absolute_url}"
                            )
                            return absolute_url
                except Exception:
                    continue
    except Exception as e:
        logger.warning(f"Smart crawler failed for {base_url}: {e}")
    return None


async def find_contact_page(
    session: aiohttp.ClientSession, domain: str
) -> str:
    """Основная функция поиска: проверка главной -> sitemap -> стандартные пути -> умный паук."""
    base_url = sanitize_url(domain)

    base_url = sanitize_url(domain)

    try:
        async with session.get(
            base_url, timeout=ClientTimeout(total=7)
        ) as response:
            if response.status == 200:
                html = await response.text(errors="ignore")
                contacts = extract_contacts(html, "ru")
                if contacts.get("emails"):
                    logger.info(f"Found emails on main page: {base_url}")
                    return base_url
    except Exception as e:
        logger.debug(f"Failed to check main page for emails: {e}")

    if sitemap_urls := await fetch_and_parse_sitemap(
        session, base_url.rstrip("/") + "/sitemap.xml", set()
    ):
        for url in sitemap_urls:
            if any(keyword in url.lower() for keyword in CONTACT_KEYWORDS):
                try:
                    async with session.head(
                        url,
                        timeout=ClientTimeout(total=3),
                        allow_redirects=True,
                    ) as r:
                        if 200 <= r.status < 300:
                            logger.info(
                                f"Found contact page via sitemap: {str(r.url)}"
                            )
                            return str(r.url)
                except Exception:
                    continue

    for path in CONTACT_PATHS:
        try:
            contact_url = base_url.rstrip("/") + path
            async with session.get(
                contact_url,
                timeout=ClientTimeout(total=5),
                allow_redirects=True,
            ) as r:
                if 200 <= r.status < 300:
                    html = await r.text(errors="ignore")
                    contacts = extract_contacts(html, "ru")
                    if contacts.get("emails"):
                        logger.info(
                            f"Found contact page with emails at standard path: {str(r.url)}"
                        )
                        return str(r.url)
                    else:
                        logger.debug(
                            f"Contact page found but no emails: {str(r.url)}"
                        )
        except Exception:
            continue

    logger.debug(
        f"Sitemap/standard paths failed for {domain}. Starting smart crawler."
    )
    if crawled_url := await crawl_for_contact_page(session, base_url):
        return crawled_url

    return base_url


def normalize_email(raw: str) -> str:
    return raw.split(":", 1)[-1].strip().lower()


def _decode_cfemail(encoded: str) -> str | None:
    """Decode Cloudflare data-cfemail value."""
    try:
        data = bytes.fromhex(encoded)
        key = data[0]
        decoded_chars = [chr(b ^ key) for b in data[1:]]
        return "".join(decoded_chars)
    except Exception:
        return None


def _decode_rot13(value: str) -> str:
    """Decode value assuming simple ROT13 obfuscation."""
    return codecs.decode(value, "rot_13")


def extract_obfuscated_emails(html: str) -> tuple[set[str], set[str]]:
    """
    Detect common JS/email-obfuscation patterns (HostCMS, Cloudflare, ROT13 mailto)
    so that visible addresses on landing pages are not lost.
    """
    decoded: set[str] = set()
    encoded_variants: set[str] = set()

    for payload in HOSTCMS_EMAIL_PATTERN.findall(html):
        normalized_payload = payload.strip()
        candidate = _decode_rot13(normalized_payload)
        if "@" in candidate and is_valid_email(candidate):
            decoded.add(candidate.lower())
            encoded_variants.add(normalized_payload.lower())

    for payload in ROT13_MAILTO_PATTERN.findall(html):
        normalized_payload = payload.strip()
        candidate = _decode_rot13(normalized_payload)
        if is_valid_email(candidate):
            decoded.add(candidate.lower())
            encoded_variants.add(normalized_payload.lower())

    for encoded in CFEMAIL_PATTERN.findall(html):
        candidate = _decode_cfemail(encoded)
        if candidate and is_valid_email(candidate):
            decoded.add(candidate.lower())

    return decoded, encoded_variants


def extract_contacts(html: str, region: str) -> dict[str, list[str] | str]:
    tree = HTMLParser(html)
    emails, phones = set(), set()
    decoded_obfuscated, obfuscated_variants = extract_obfuscated_emails(html)
    emails.update(decoded_obfuscated)

    for link in tree.css('a[href^="mailto:"]'):
        if (href := link.attributes.get("href")) and is_valid_email(
            email := normalize_email(href)
        ):
            if email in obfuscated_variants:
                continue
            emails.add(email)

    footer_elements = tree.css(
        'footer, .footer, #footer, [class*="footer"], [id*="footer"]'
    )
    for footer in footer_elements:
        footer_text = footer.text(separator=" ")
        for match in EMAIL_RE.finditer(footer_text):
            if is_valid_email(email := match.group(0)):
                if email.lower() in obfuscated_variants:
                    continue
                emails.add(email.lower())

    nav_elements = tree.css(
        'header, nav, .header, .nav, .menu, .navigation, [class*="header"], [class*="nav"], [class*="menu"]'
    )
    for nav in nav_elements:
        nav_text = nav.text(separator=" ")
        for match in EMAIL_RE.finditer(nav_text):
            if is_valid_email(email := match.group(0)):
                if email.lower() in obfuscated_variants:
                    continue
                emails.add(email.lower())

    contact_elements = tree.css(
        '.contact, .contacts, .info, [class*="contact"], [class*="info"]'
    )
    for contact in contact_elements:
        contact_text = contact.text(separator=" ")
        for match in EMAIL_RE.finditer(contact_text):
            if is_valid_email(email := match.group(0)):
                if email.lower() in obfuscated_variants:
                    continue
                emails.add(email.lower())

    text = tree.text(separator=" ")
    for match in EMAIL_RE.finditer(text):
        if is_valid_email(email := match.group(0)):
            if email.lower() in obfuscated_variants:
                continue
            emails.add(email.lower())

    for link in tree.css('a[href^="tel:"]'):
        if phone := link.attributes.get("href"):
            try:
                num = phonenumbers.parse(
                    phone.split(":", 1)[-1], region.upper()
                )
                if phonenumbers.is_valid_number(num):
                    phones.add(
                        phonenumbers.format_number(
                            num, phonenumbers.PhoneNumberFormat.E164
                        )
                    )
            except Exception:
                continue

    for match in phonenumbers.PhoneNumberMatcher(text, region.upper()):
        if phonenumbers.is_valid_number(match.number):
            phones.add(
                phonenumbers.format_number(
                    match.number, phonenumbers.PhoneNumberFormat.E164
                )
            )

    page_title = ""
    try:
        title_tag = tree.css_first("title")
        if title_tag:
            page_title = title_tag.text(separator=" ").strip()
            if page_title:
                logger.debug(f"Extracted page_title: '{page_title[:100]}...'")
    except Exception as e:
        logger.debug(f"[EXTRACT] Error extracting page_title: {e}")
        pass

    return {
        "emails": sorted(emails),
        "phones": sorted(phones),
        "page_title": page_title,
    }


async def fetch_contacts(
    domain: str, session: aiohttp.ClientSession, semaphore: asyncio.Semaphore
) -> dict[str, list[str] | str]:
    async with semaphore:
        contact_url = ""
        page_title = ""
        try:
            base_url = sanitize_url(domain)
            try:
                async with session.get(
                    base_url, timeout=ClientTimeout(total=7)
                ) as main_response:
                    if main_response.status == 200:
                        main_html = await main_response.text(errors="ignore")
                        main_data = extract_contacts(main_html, "ru")
                        page_title = main_data.get("page_title", "")
            except Exception as e:
                logger.debug(f"Failed to get title from main page: {e}")

            contact_url = await find_contact_page(session, domain)
            async with session.get(
                contact_url, timeout=ClientTimeout(total=10)
            ) as response:
                html = await response.text(errors="ignore")
            data = extract_contacts(html, "ru")

            if not page_title:
                page_title = data.get("page_title", "")
                if page_title:
                    logger.debug(
                        f"Using page_title from contact page as fallback: '{page_title}'"
                    )
                else:
                    logger.debug(f"No page_title found for domain: {domain}")
            else:
                logger.debug(
                    f"Using page_title from main page: '{page_title}'"
                )

            data["page_title"] = page_title

            result: dict[str, list[str] | str] = {
                "domain": domain,
                "url": contact_url,
                **data,
            }
            return result
        except Exception as e:
            logger.error(
                f"Failed to process {domain} (URL: {contact_url}): {e}"
            )
            return {
                "domain": domain,
                "url": contact_url,
                "emails": [],
                "phones": [],
                "page_title": page_title,
            }


async def get_info(
    domains: list[str], max_concurrent_requests: int
) -> list[dict]:
    ua = UserAgent()
    headers = {"User-Agent": ua.random}
    semaphore = asyncio.Semaphore(max_concurrent_requests)
    connector = aiohttp.TCPConnector(limit_per_host=10, ssl=False)

    async with aiohttp.ClientSession(
        connector=connector, headers=headers
    ) as session:
        tasks = [
            fetch_contacts(domain, session, semaphore) for domain in domains
        ]
        results = await asyncio.gather(*tasks)
    filtered = [
        r for r in results if r and (r.get("emails") or r.get("phones"))
    ]
    logger.info(
        f"Completed for {len(domains)} domains. Found contacts for {len(filtered)} of them."
    )
    return filtered


async def main():
    domains_to_check = [
        "google.com",
        "github.com",
        "sitemaps.org",
        "microsoft.com",
        "stackoverflow.com",
        "nct.by",
    ]
    max_requests = 10
    results = await get_info(domains_to_check, max_requests)

    import json

    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
