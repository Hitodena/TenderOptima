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
    from .utils.logger import CustomLogger
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
        async with session.get(sitemap_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
            if response.status != 200: return []
            root = ET.fromstring(await response.read())
            if root.tag.endswith('sitemapindex'):
                sitemap_locs = [s.find('{*}loc').text for s in root.findall('{*}sitemap') if s.find('{*}loc') is not None]
                tasks = [fetch_and_parse_sitemap(session, loc, processed_sitemaps) for loc in sitemap_locs]
                results = await asyncio.gather(*tasks)
                for result in results: urls.extend(result)
            elif root.tag.endswith('urlset'):
                urls.extend([u.find('{*}loc').text for u in root.findall('{*}url') if u.find('{*}loc') is not None])
    except Exception as e:
        logger.error(f"Error processing sitemap {sitemap_url}: {e}")
    return urls

async def crawl_for_contact_page(session: aiohttp.ClientSession, base_url: str, visited: Set[str], depth: int = 1) -> Optional[str]:
    if depth < 0 or base_url in visited:
        return None
    visited.add(base_url)
    logger.debug(f"Crawling: {base_url} at depth {depth}")
    
    try:
        async with session.get(base_url, timeout=aiohttp.ClientTimeout(total=5)) as response:
            if response.status != 200: return None
            html = await response.text(errors='ignore')
            
        tree = HTMLParser(html)
        main_domain = urlparse(base_url).netloc
        
        links_for_next_depth = []
        for link in tree.css('a[href]'):
            href = link.attributes.get('href', '').strip()
            if not href or href.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
                continue
            
            absolute_url = urljoin(base_url, href)
            
            if urlparse(absolute_url).netloc != main_domain:
                continue
                
            link_text = (link.text() + " " + href).lower()
            if any(keyword in link_text for keyword in CONTACT_KEYWORDS):
                logger.info(f"Found potential contact page via crawler: {absolute_url}")
                return absolute_url # Немедленно возвращаем, если нашли явного кандидата
            
            links_for_next_depth.append(absolute_url)

        if depth > 0:
            for next_url in links_for_next_depth:
                found_url = await crawl_for_contact_page(session, next_url, visited, depth - 1)
                if found_url:
                    return found_url # Возвращаем первый найденный в глубине
                        
    except Exception as e:
        logger.warning(f"Crawler failed for {base_url}: {e}")
    return None

async def find_contact_page(session: aiohttp.ClientSession, domain: str) -> str:
    base_url = sanitize_url(domain)
    
    # 1. Поиск через sitemap.xml
    sitemap_url = base_url.rstrip('/') + '/sitemap.xml'
    sitemap_urls = await fetch_and_parse_sitemap(session, sitemap_url, processed_sitemaps=set())
    if sitemap_urls:
        for url in sitemap_urls:
            if any(keyword in url.lower() for keyword in CONTACT_KEYWORDS):
                try:
                    async with session.head(url, timeout=aiohttp.ClientTimeout(3), allow_redirects=True) as response:
                        if 200 <= response.status < 300:
                            logger.info(f"Found contact page via sitemap: {response.url}")
                            return str(response.url)
                except Exception: continue

    # 2. Проверка стандартных путей
    for path in CONTACT_PATHS:
        url = base_url.rstrip('/') + path
        try:
            async with session.head(url, timeout=aiohttp.ClientTimeout(3), allow_redirects=True) as response:
                if 200 <= response.status < 300:
                    logger.info(f"Found contact page at standard path: {url}")
                    return str(response.url)
        except Exception: continue
    
    # 3. Запуск "паука"
    logger.debug(f"Sitemap and standard paths failed for {domain}. Starting crawler.")
    crawled_url = await crawl_for_contact_page(session, base_url, visited=set(), depth=1)
    if crawled_url:
        return crawled_url
            
    # 4. Возврат главной страницы
    logger.debug(f"No contact page found for {domain}. Defaulting to base URL.")
    return base_url

def normalize_email(raw: str) -> str:
    return raw.split(":", 1)[-1].strip().lower()

def extract_contacts(html: str, region: str) -> Dict[str, List[str]]:
    tree = HTMLParser(html)
    text = tree.text(separator=" ")
    emails, phones = set(), set()
    for link in tree.css('a[href^="mailto:"]'):
        if (href := link.attributes.get("href")) and ":" in href:
            if is_valid_email(email := normalize_email(href)):
                emails.add(email)
    for email_match in EMAIL_RE.finditer(text):
        if is_valid_email(email := email_match.group(0)):
            emails.add(email.lower())
    for link in tree.css('a[href^="tel:"]'):
        if not (phone := link.attributes.get("href")): continue
        phone_raw = phone.split(":", 1)[-1]
        try:
            num = phonenumbers.parse(phone_raw, region.upper() if not phone_raw.startswith("+") else None)
            if phonenumbers.is_valid_number(num):
                phones.add(phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164))
        except Exception: continue
    for match in phonenumbers.PhoneNumberMatcher(text, region.upper()):
        if phonenumbers.is_valid_number(match.number):
            phones.add(phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.E164))
    return {"emails": sorted(emails), "phones": sorted(phones)}

async def fetch_contacts(domain: str, session: aiohttp.ClientSession, semaphore: asyncio.Semaphore) -> Dict[str, Union[str, List]]:
    async with semaphore:
        contact_url = ""
        try:
            contact_url = await find_contact_page(session, domain)
            async with session.get(contact_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                html = await response.text(errors="ignore")
            data = extract_contacts(html, "ru")
            return {"domain": domain, "contact_url": contact_url, **data}
        except Exception as e:
            logger.error(f"Failed to fetch or process {domain} (URL: {contact_url}): {e}")
            return {"domain": domain, "contact_url": contact_url, "emails": [], "phones": []}

async def get_info(domains: List[str], max_concurrent_requests: int) -> List[Dict[str, Union[str, List]]]:
    ua = UserAgent()
    headers = {"User-Agent": ua.random}
    semaphore = asyncio.Semaphore(max_concurrent_requests)
    connector = aiohttp.TCPConnector(limit_per_host=10)
    
    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        tasks = [fetch_contacts(domain, session, semaphore) for domain in domains]
        results = await asyncio.gather(*tasks)
    filtered = [r for r in results if r and (r.get("emails") or r.get("phones"))]
    logger.info(f"Completed for {len(domains)} domains. Found info for {len(filtered)} domains.")
    return filtered

async def main():
    domains_to_check = ["google.com", "github.com", "sitemaps.org", "microsoft.com", "stackoverflow.com"]
    max_requests = 10
    results = await get_info(domains_to_check, max_requests)
    
    import json
    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
