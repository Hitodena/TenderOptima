"""
Site contact scraper.
Finds email addresses and phone numbers for a list of domains.

Key guarantees:
  - Each domain is bounded by DOMAIN_TIMEOUT (hard wall clock limit).
  - All HTTP calls have explicit per-request timeouts.
  - Sitemap parsing is depth-limited and time-bounded.
  - Every exception path logs structured context before returning an empty result.
"""

import asyncio
import codecs
import re
import xml.etree.ElementTree as ET
from urllib.parse import urljoin, urlparse

import aiohttp
import phonenumbers
from aiohttp import ClientTimeout
from email_validator import EmailNotValidError, validate_email
from fake_useragent import UserAgent
from loguru import logger
from selectolax.parser import HTMLParser

# ---------------------------------------------------------------------------
# Timeouts (seconds)
# ---------------------------------------------------------------------------
DOMAIN_TIMEOUT = 30  # hard cap per domain — wraps entire fetch_contacts
MAIN_PAGE_TIMEOUT = 7  # GET main page
SITEMAP_FETCH_TIMEOUT = 8  # single sitemap file fetch
SITEMAP_MAX_DEPTH = 2  # max sitemap index recursion levels
CONTACT_PATH_TIMEOUT = 6  # GET known contact-path URLs
HEAD_CHECK_TIMEOUT = 2  # HEAD probe in smart crawler
CRAWLER_MAIN_TIMEOUT = 6  # GET main page inside smart crawler
FINAL_FETCH_TIMEOUT = 10  # GET resolved contact page

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def sanitize_url(domain: str) -> str:
    if not re.match(r"^https?://", domain):
        return f"https://{domain}"
    return domain


def is_valid_email(addr: str) -> bool:
    try:
        validate_email(addr, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def normalize_email(raw: str) -> str:
    return raw.split(":", 1)[-1].strip().lower()


def _decode_cfemail(encoded: str) -> str | None:
    try:
        data = bytes.fromhex(encoded)
        key = data[0]
        return "".join(chr(b ^ key) for b in data[1:])
    except Exception:
        return None


def _decode_rot13(value: str) -> str:
    return codecs.decode(value, "rot_13")


# ---------------------------------------------------------------------------
# Email obfuscation decoders
# ---------------------------------------------------------------------------


def extract_obfuscated_emails(html: str) -> tuple[set[str], set[str]]:
    """
    Detect and decode HostCMS / ROT13-mailto / Cloudflare cfemail obfuscation.
    Returns (decoded_emails, raw_obfuscated_variants).
    """
    decoded: set[str] = set()
    encoded_variants: set[str] = set()

    for payload in HOSTCMS_EMAIL_PATTERN.findall(html):
        payload = payload.strip()
        candidate = _decode_rot13(payload)
        if "@" in candidate and is_valid_email(candidate):
            decoded.add(candidate.lower())
            encoded_variants.add(payload.lower())

    for payload in ROT13_MAILTO_PATTERN.findall(html):
        payload = payload.strip()
        candidate = _decode_rot13(payload)
        if is_valid_email(candidate):
            decoded.add(candidate.lower())
            encoded_variants.add(payload.lower())

    for encoded in CFEMAIL_PATTERN.findall(html):
        candidate = _decode_cfemail(encoded)
        if candidate and is_valid_email(candidate):
            decoded.add(candidate.lower())

    return decoded, encoded_variants


# ---------------------------------------------------------------------------
# HTML contact extraction
# ---------------------------------------------------------------------------


def extract_contacts(html: str, region: str) -> dict:
    tree = HTMLParser(html)
    emails: set[str] = set()
    phones: set[str] = set()

    decoded_obfuscated, obfuscated_variants = extract_obfuscated_emails(html)
    emails.update(decoded_obfuscated)

    def _add_email(addr: str) -> None:
        if addr.lower() not in obfuscated_variants and is_valid_email(addr):
            emails.add(addr.lower())

    # Explicit mailto links
    for link in tree.css('a[href^="mailto:"]'):
        href = link.attributes.get("href") or ""
        _add_email(normalize_email(href))

    # Structural zones: footer, nav, contact containers
    for selector in [
        'footer, .footer, #footer, [class*="footer"], [id*="footer"]',
        'header, nav, .header, .nav, .menu, .navigation, [class*="header"], [class*="nav"], [class*="menu"]',
        '.contact, .contacts, .info, [class*="contact"], [class*="info"]',
    ]:
        for el in tree.css(selector):
            for m in EMAIL_RE.finditer(el.text(separator=" ")):
                _add_email(m.group(0))

    # Full-page sweep (catches anything missed above)
    for m in EMAIL_RE.finditer(tree.text(separator=" ")):
        _add_email(m.group(0))

    # Tel links
    for link in tree.css('a[href^="tel:"]'):
        raw_phone = (link.attributes.get("href") or "").split(":", 1)[-1]
        try:
            num = phonenumbers.parse(raw_phone, region.upper())
            if phonenumbers.is_valid_number(num):
                phones.add(
                    phonenumbers.format_number(
                        num, phonenumbers.PhoneNumberFormat.E164
                    )
                )
        except Exception:
            pass

    # Text-embedded phone numbers
    for m in phonenumbers.PhoneNumberMatcher(
        tree.text(separator=" "), region.upper()
    ):
        if phonenumbers.is_valid_number(m.number):
            phones.add(
                phonenumbers.format_number(
                    m.number, phonenumbers.PhoneNumberFormat.E164
                )
            )

    # Page title
    page_title = ""
    try:
        title_tag = tree.css_first("title")
        if title_tag:
            page_title = title_tag.text(separator=" ").strip()
    except Exception:
        pass

    return {
        "emails": sorted(emails),
        "phones": sorted(phones),
        "page_title": page_title,
    }


# ---------------------------------------------------------------------------
# Sitemap
# ---------------------------------------------------------------------------


async def _fetch_sitemap(
    session: aiohttp.ClientSession,
    sitemap_url: str,
    processed: set[str],
    depth: int = 0,
) -> list[str]:
    """Recursively parse sitemap, bounded by depth and per-file timeout."""
    if sitemap_url in processed or depth > SITEMAP_MAX_DEPTH:
        return []
    processed.add(sitemap_url)

    try:
        async with session.get(
            sitemap_url,
            timeout=ClientTimeout(total=SITEMAP_FETCH_TIMEOUT),
            allow_redirects=True,
        ) as resp:
            if resp.status != 200:
                return []
            content = await resp.read()
    except TimeoutError:
        logger.debug("Sitemap fetch timeout", url=sitemap_url)
        return []
    except Exception as exc:
        logger.debug(
            "Sitemap fetch error",
            url=sitemap_url,
            error=exc,
        )
        return []

    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        logger.debug(
            "Sitemap XML parse error",
            url=sitemap_url,
            error=exc,
        )
        return []

    urls: list[str] = []

    if root.tag.endswith("sitemapindex"):
        child_locs = [
            loc_el.text
            for sm in root.findall("{*}sitemap")
            if (loc_el := sm.find("{*}loc")) is not None and loc_el.text
        ]
        tasks = [
            _fetch_sitemap(session, loc, processed, depth + 1)
            for loc in child_locs
        ]
        for result in await asyncio.gather(*tasks, return_exceptions=True):
            if isinstance(result, list):
                urls.extend(result)
    elif root.tag.endswith("urlset"):
        urls = [
            loc_el.text
            for u in root.findall("{*}url")
            if (loc_el := u.find("{*}loc")) is not None and loc_el.text
        ]

    return urls


# ---------------------------------------------------------------------------
# Contact page discovery
# ---------------------------------------------------------------------------


async def _crawl_for_contact_page(
    session: aiohttp.ClientSession, base_url: str
) -> str | None:
    """Follow internal links on the main page that look like contact pages."""
    try:
        async with session.get(
            base_url,
            timeout=ClientTimeout(total=CRAWLER_MAIN_TIMEOUT),
            allow_redirects=True,
        ) as resp:
            if resp.status != 200:
                return None
            html = await resp.text(errors="ignore")
    except TimeoutError:
        logger.debug("Smart-crawler main-page timeout", url=base_url)
        return None
    except Exception as exc:
        logger.debug(
            "Smart-crawler main-page error",
            url=base_url,
            error=exc,
        )
        return None

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
        if not any(kw in link_text for kw in CONTACT_KEYWORDS):
            continue

        try:
            async with session.head(
                absolute_url,
                timeout=ClientTimeout(total=HEAD_CHECK_TIMEOUT),
                allow_redirects=True,
            ) as head_resp:
                if 200 <= head_resp.status < 300:
                    logger.debug(
                        "Contact page found via crawler",
                        url=absolute_url,
                    )
                    return absolute_url
        except Exception:
            continue

    return None


async def find_contact_page(
    session: aiohttp.ClientSession, domain: str
) -> str:
    """
    Discovery order:
      1. Emails on main page → return base_url
      2. Sitemap → first URL matching contact keywords
      3. Known contact paths → first with emails
      4. Smart crawler → first matching contact link
      5. Fall back to base_url
    """
    base_url = sanitize_url(domain)

    # 1. Check main page for emails
    try:
        async with session.get(
            base_url, timeout=ClientTimeout(total=MAIN_PAGE_TIMEOUT)
        ) as resp:
            if resp.status == 200:
                html = await resp.text(errors="ignore")
                if extract_contacts(html, "ru").get("emails"):
                    logger.debug("Emails on main page", url=base_url)
                    return base_url
    except TimeoutError:
        logger.debug("Main page timeout", url=base_url)
    except Exception as exc:
        logger.debug(
            "Main page error",
            url=base_url,
            error=exc,
        )

    # 2. Sitemap
    sitemap_url = base_url.rstrip("/") + "/sitemap.xml"
    sitemap_urls = await _fetch_sitemap(session, sitemap_url, set())
    for url in sitemap_urls:
        if any(kw in url.lower() for kw in CONTACT_KEYWORDS):
            try:
                async with session.head(
                    url,
                    timeout=ClientTimeout(total=HEAD_CHECK_TIMEOUT),
                    allow_redirects=True,
                ) as r:
                    if 200 <= r.status < 300:
                        logger.debug(
                            "Contact page via sitemap",
                            url=str(r.url),
                        )
                        return str(r.url)
            except Exception:
                continue

    # 3. Known contact paths
    for path in CONTACT_PATHS:
        contact_url = base_url.rstrip("/") + path
        try:
            async with session.get(
                contact_url,
                timeout=ClientTimeout(total=CONTACT_PATH_TIMEOUT),
                allow_redirects=True,
            ) as r:
                if 200 <= r.status < 300:
                    html = await r.text(errors="ignore")
                    if extract_contacts(html, "ru").get("emails"):
                        logger.debug(
                            "Contact page with emails at path",
                            url=str(r.url),
                        )
                        return str(r.url)
        except TimeoutError:
            logger.debug("Path timeout", url=contact_url)
            continue
        except Exception:
            continue

    # 4. Smart crawler
    crawled = await _crawl_for_contact_page(session, base_url)
    if crawled:
        return crawled

    return base_url


# ---------------------------------------------------------------------------
# Per-domain contact fetch
# ---------------------------------------------------------------------------


async def _fetch_contacts_inner(
    domain: str,
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
) -> dict:
    """
    Core logic. Does not enforce DOMAIN_TIMEOUT — that's done by the caller.
    """
    async with semaphore:
        contact_url = ""
        page_title = ""

        # Grab page title from main page first
        try:
            base_url = sanitize_url(domain)
            async with session.get(
                base_url, timeout=ClientTimeout(total=MAIN_PAGE_TIMEOUT)
            ) as resp:
                if resp.status == 200:
                    main_html = await resp.text(errors="ignore")
                    page_title = extract_contacts(main_html, "ru").get(
                        "page_title", ""
                    )
        except TimeoutError:
            logger.debug("Title fetch timeout", url=domain)
        except Exception as exc:
            logger.debug(
                "Title fetch error",
                url=domain,
                error=exc,
            )

        # Locate contact page
        try:
            contact_url = await find_contact_page(session, domain)
        except Exception as exc:
            logger.warning(
                "find_contact_page failed",
                url=domain,
                error=exc,
            )
            contact_url = sanitize_url(domain)

        # Fetch and parse contact page
        try:
            async with session.get(
                contact_url, timeout=ClientTimeout(total=FINAL_FETCH_TIMEOUT)
            ) as resp:
                html = await resp.text(errors="ignore")
            data = extract_contacts(html, "ru")
        except TimeoutError:
            logger.warning(
                "Contact page fetch timeout",
                domain=domain,
                url=contact_url,
            )
            return {
                "domain": domain,
                "url": contact_url,
                "emails": [],
                "phones": [],
                "page_title": page_title,
            }
        except Exception as exc:
            logger.error(
                "Contact page fetch error",
                domain=domain,
                url=contact_url,
                error=exc,
            )
            return {
                "domain": domain,
                "url": contact_url,
                "emails": [],
                "phones": [],
                "page_title": page_title,
            }

        if not page_title:
            page_title = data.get("page_title", "")

        result = {
            "domain": domain,
            "url": contact_url,
            "emails": data.get("emails", []),
            "phones": data.get("phones", []),
            "page_title": page_title,
        }

        logger.info(
            "Domain scrape done",
            domain=domain,
            emails=len(result["emails"]),
            phones=len(result["phones"]),
            url=contact_url,
        )
        return result


async def fetch_contacts(
    domain: str,
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
) -> dict:
    """
    Fetch contacts for a single domain, hard-bounded by DOMAIN_TIMEOUT.
    Never raises — always returns a dict (possibly with empty emails/phones).
    """
    empty = {
        "domain": domain,
        "url": "",
        "emails": [],
        "phones": [],
        "page_title": "",
    }
    try:
        return await asyncio.wait_for(
            _fetch_contacts_inner(domain, session, semaphore),
            timeout=DOMAIN_TIMEOUT,
        )
    except TimeoutError:
        logger.warning(
            "Hard timeout reached",
            timeout=DOMAIN_TIMEOUT,
            domain=domain,
        )
        return empty
    except Exception:
        logger.exception("Unhandled error", domain=domain)
        return empty


# ---------------------------------------------------------------------------
# Batch entry point
# ---------------------------------------------------------------------------


async def get_info(
    domains: list[str],
    max_concurrent_requests: int,
) -> list[dict]:
    """
    Scrape contact info for all domains concurrently.

    Args:
        domains:                List of domain strings (with or without scheme).
        max_concurrent_requests: Semaphore width — how many domains to process
                                 simultaneously.

    Returns:
        Only results that contain at least one email or phone.
    """
    ua = UserAgent()
    semaphore = asyncio.Semaphore(max_concurrent_requests)
    connector = aiohttp.TCPConnector(
        limit=max_concurrent_requests * 2,
        limit_per_host=3,  # conservative — avoid hammering single hosts
        ssl=False,
        ttl_dns_cache=300,
        enable_cleanup_closed=True,
    )
    headers = {"User-Agent": ua.random}

    logger.info(
        "Batch start",
        domains=len(domains),
        concurrency=max_concurrent_requests,
    )

    async with aiohttp.ClientSession(
        connector=connector, headers=headers
    ) as session:
        tasks = [fetch_contacts(d, session, semaphore) for d in domains]
        results: list[dict] = await asyncio.gather(*tasks)

    with_contacts = [r for r in results if r.get("emails") or r.get("phones")]

    logger.info(
        "Batch done",
        total=len(results),
        with_contacts=len(with_contacts),
        empty=len(results) - len(with_contacts),
    )
    return with_contacts
