import asyncio
import re
from typing import Dict, List, Optional, Set, Union
import xml.etree.ElementTree as ET
import sys
from urllib.parse import urljoin, urlparse

import aiohttp
import phonenumbers
from email_validator import EmailNotValidError, validate_email
from fake_useragent import UserAgent
from selectolax.parser import HTMLParser

# Заглушка для логгера
try:
    from parsers.utils.logger import CustomLogger
    logger = CustomLogger("ContactInfoGetter", "ContactInfoGetter.log", debug=False, console=True).get_logger()
except (ImportError, ModuleNotFoundError):
    import logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger("ContactInfoGetter")

# Константы
CONTACT_PATHS = ["/contact", "/contacts", "/контакты", "/about", "/о-компании", "/impressum", "/legal"]
CONTACT_KEYWORDS = ["contact", "about", "impressum", "legal", "kontakty", "о-нас", "связаться", "feedback"]
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

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

async def fetch_and_parse_sitemap(session: aiohttp.ClientSession, sitemap_url: str, processed_sitemaps: set) -> List[str]:
    if sitemap_url in processed_sitemaps: return []
    processed_sitemaps.add(sitemap_url)
    logger.debug(f"Parsing sitemap: {sitemap_url}")
    urls = []
    try:
        async with session.get(sitemap_url, timeout=10) as response:
            if response.status != 200: return []
            root = ET.fromstring(await response.read())
            if root.tag.endswith('sitemapindex'):
                sitemap_locs = [s.find('{*}loc').text for s in root.findall('{*}sitemap') if s.find('{*}loc')]
                tasks = [fetch_and_parse_sitemap(session, loc, processed_sitemaps) for loc in sitemap_locs]
                for result in await asyncio.gather(*tasks): urls.extend(result)
            elif root.tag.endswith('urlset'):
                urls.extend([u.find('{*}loc').text for u in root.findall('{*}url') if u.find('{*}loc')])
    except Exception as e:
        logger.error(f"Error processing sitemap {sitemap_url}: {e}")
    return urls

# ОБНОВЛЕННАЯ, БЫСТРАЯ ФУНКЦИЯ "УМНОГО ПАУКА"
async def crawl_for_contact_page(session: aiohttp.ClientSession, base_url: str) -> Optional[str]:
    """
    "Умный" паук, который сканирует ТОЛЬКО главную страницу в поисках ссылки на контакты.
    Он не уходит вглубь, что значительно ускоряет процесс.
    """
    logger.debug(f"Smart-crawling main page: {base_url}")
    try:
        async with session.get(base_url, timeout=7) as response:
            if response.status != 200: return None
            html = await response.text(errors='ignore')

        tree = HTMLParser(html)
        main_domain = urlparse(base_url).netloc

        for link in tree.css('a[href]'):
            href = link.attributes.get('href', '').strip()
            if not href or href.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
                continue

            absolute_url = urljoin(base_url, href)
            if urlparse(absolute_url).netloc != main_domain:
                continue

            link_text = (link.text() + " " + href).lower()
            if any(keyword in link_text for keyword in CONTACT_KEYWORDS):
                try:
                    async with session.head(absolute_url, timeout=2, allow_redirects=True) as head_response:
                        if 200 <= head_response.status < 300:
                            logger.info(f"Found contact page via smart crawler: {absolute_url}")
                            return absolute_url
                except Exception:
                    continue
    except Exception as e:
        logger.warning(f"Smart crawler failed for {base_url}: {e}")
    return None

async def find_contact_page(session: aiohttp.ClientSession, domain: str) -> str:
    """Основная функция поиска: sitemap -> стандартные пути -> умный паук."""
    base_url = sanitize_url(domain)
    
    # 1. Поиск через sitemap.xml
    if (sitemap_urls := await fetch_and_parse_sitemap(session, base_url.rstrip('/') + '/sitemap.xml', set())):
        for url in sitemap_urls:
            if any(keyword in url.lower() for keyword in CONTACT_KEYWORDS):
                try:
                    async with session.head(url, timeout=3, allow_redirects=True) as r:
                        if 200 <= r.status < 300:
                            logger.info(f"Found contact page via sitemap: {str(r.url)}")
                            return str(r.url)
                except Exception: continue

    # 2. Проверка стандартных путей
    for path in CONTACT_PATHS:
        try:
            async with session.head(base_url.rstrip('/') + path, timeout=3, allow_redirects=True) as r:
                if 200 <= r.status < 300:
                    logger.info(f"Found contact page at standard path: {str(r.url)}")
                    return str(r.url)
        except Exception: continue
    
    # 3. Запуск "умного паука"
    logger.debug(f"Sitemap/standard paths failed for {domain}. Starting smart crawler.")
    if (crawled_url := await crawl_for_contact_page(session, base_url)):
        return crawled_url
            
    # 4. Возврат главной страницы
    logger.debug(f"No contact page found for {domain}. Defaulting to base URL.")
    return base_url

# --- Остальные функции (normalize_email, extract_contacts, и т.д.) ---

def normalize_email(raw: str) -> str:
    return raw.split(":", 1)[-1].strip().lower()

def extract_contacts(html: str, region: str) -> Dict[str, List[str]]:
    tree = HTMLParser(html)
    text = tree.text(separator=" ")
    emails, phones = set(), set()
    for link in tree.css('a[href^="mailto:"]'):
        if (href := link.attributes.get("href")) and is_valid_email(email := normalize_email(href)):
            emails.add(email)
    for match in EMAIL_RE.finditer(text):
        if is_valid_email(email := match.group(0)):
            emails.add(email.lower())
    for link in tree.css('a[href^="tel:"]'):
        if (phone := link.attributes.get("href")):
            try:
                num = phonenumbers.parse(phone.split(":", 1)[-1], region.upper())
                if phonenumbers.is_valid_number(num): phones.add(phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164))
            except Exception: continue
    for match in phonenumbers.PhoneNumberMatcher(text, region.upper()):
        if phonenumbers.is_valid_number(match.number):
            phones.add(phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.E164))
    return {"emails": sorted(emails), "phones": sorted(phones)}

async def fetch_contacts(domain: str, session: aiohttp.ClientSession, semaphore: asyncio.Semaphore) -> Dict:
    async with semaphore:
        contact_url = ""
        try:
            contact_url = await find_contact_page(session, domain)
            async with session.get(contact_url, timeout=10) as response:
                html = await response.text(errors="ignore")
            data = extract_contacts(html, "ru")
            return {"domain": domain, "url": contact_url, **data}
        except Exception as e:
            logger.error(f"Failed to process {domain} (URL: {contact_url}): {e}")
            return {"domain": domain, "url": contact_url, "emails": [], "phones": []}

async def get_info(domains: List[str], max_concurrent_requests: int) -> List[Dict]:
    ua = UserAgent()
    headers = {"User-Agent": ua.random}
    semaphore = asyncio.Semaphore(max_concurrent_requests)
    connector = aiohttp.TCPConnector(limit_per_host=10, ssl=False)
    
    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        tasks = [fetch_contacts(domain, session, semaphore) for domain in domains]
        results = await asyncio.gather(*tasks)
    filtered = [r for r in results if r and (r.get("emails") or r.get("phones"))]
    logger.info(f"Completed for {len(domains)} domains. Found contacts for {len(filtered)} of them.")
    return filtered

async def main():
    domains_to_check = ["google.com", "github.com", "sitemaps.org", "microsoft.com", "stackoverflow.com", "nct.by"]
    max_requests = 10
    results = await get_info(domains_to_check, max_requests)
    
    import json
    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())

