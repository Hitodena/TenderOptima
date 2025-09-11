"""
Authentic Yandex Search Scraper for SupplierFinder
Performs real web scraping of actual Yandex search results
Only returns genuine data from real sources - no synthetic data
"""

import requests
import sys
import json
import time
import random
import re
from bs4 import BeautifulSoup
from urllib.parse import quote, urljoin, urlparse, unquote
from fake_useragent import UserAgent
import argparse

class AuthenticYandexSearchScraper:
    def __init__(self):
        self.ua = UserAgent()
        self.session = requests.Session()
        
        # Yandex region codes
        self.regions = {
            'Москва': '213',
            'Санкт-Петербург': '2',
            'Новосибирск': '65',
            'Екатеринбург': '54',
            'Нижний Новгород': '47',
            'Казань': '43',
            'Челябинск': '56',
            'Омск': '66',
            'Самара': '51',
            'Ростов-на-Дону': '39',
            'Уфа': '172',
            'Красноярск': '62',
            'Пермь': '50',
            'Воронеж': '193',
            'Волгоград': '38'
        }

    def get_region_code(self, region_name):
        """Get Yandex region code by name"""
        return self.regions.get(region_name, '213')

    def build_yandex_url(self, keyword, region_code, language, include_ads, page=0):
        """Build Yandex search URL with all parameters"""
        base_url = "https://yandex.ru/search/"
        
        params = {
            'text': keyword,
            'lr': region_code,
            'lang': language,
            'p': page
        }
        
        if not include_ads:
            params['filter'] = '1'
            
        url = base_url + '?' + '&'.join([f'{k}={quote(str(v))}' for k, v in params.items()])
        return url

    def get_random_headers(self):
        """Generate random headers to avoid detection"""
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        
        return {
            'User-Agent': random.choice(user_agents),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'DNT': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Referer': 'https://google.com/',
            'X-Forwarded-For': f'{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}'
        }

    def extract_search_results(self, html_content, include_ads=True):
        """Extract authentic search results from Yandex HTML"""
        soup = BeautifulSoup(html_content, 'html.parser')
        results = []
        
        print(f"HTML content length: {len(html_content)}", file=sys.stderr)
        
        # Multiple selectors for different Yandex layouts
        result_selectors = [
            '.serp-item',
            '.VanillaReact.Organic',
            '.MMOrganicSnippet',
            '.Organic',
            '.content_type_organic',
            '.organic',
            '[data-log-node="serp-item"]'
        ]
        
        found_results = []
        for selector in result_selectors:
            elements = soup.select(selector)
            if elements:
                print(f"Found {len(elements)} results with selector: {selector}", file=sys.stderr)
                found_results.extend(elements)
                break
        
        # If structured selectors fail, try to find any links that look like search results
        if not found_results:
            print("No structured results found, looking for any relevant links", file=sys.stderr)
            all_links = soup.find_all('a', href=True)
            found_results = [link for link in all_links if self._is_search_result_link(link)]
            print(f"Found {len(found_results)} potential result links", file=sys.stderr)
        
        for i, result in enumerate(found_results[:10]):  # Limit to top 10
            try:
                print(f"Processing result {i+1}", file=sys.stderr)
                
                # Skip ads if not requested
                if not include_ads:
                    result_classes = ' '.join(result.get('class', []))
                    if any(cls in result_classes.lower() for cls in ['commercial', 'adv', 'direct', 'ad']):
                        print(f"Skipping ad result {i+1}", file=sys.stderr)
                        continue
                
                # Extract URL and title
                url = ""
                title = ""
                
                if result.name == 'a':
                    url = result.get('href', '')
                    title = result.get_text(strip=True)
                else:
                    # Look for link within result
                    link_selectors = [
                        'h3 a', 'h2 a', '.OrganicTitle-Link',
                        '.Organic-TitleLink', '.serp-item__title a',
                        'a[href*="http"]', '.organic__url'
                    ]
                    
                    for sel in link_selectors:
                        link_elem = result.select_one(sel)
                        if link_elem:
                            url = link_elem.get('href', '')
                            title = link_elem.get_text(strip=True)
                            break
                
                if not url or not title:
                    print(f"No URL or title found for result {i+1}", file=sys.stderr)
                    continue
                
                # Clean URL
                url = self._clean_url(url)
                if not url or 'yandex.ru' in url:
                    print(f"Invalid URL for result {i+1}: {url}", file=sys.stderr)
                    continue
                
                # Extract description
                description = self._extract_description(result)
                
                # Extract company name
                company_name = self._extract_company_name(title, url)
                
                print(f"Extracted result {i+1}: {company_name} - {url}", file=sys.stderr)
                
                # Basic validation
                if len(title) > 3 and len(company_name) > 2:
                    results.append({
                        'url': url,
                        'company_name': company_name,
                        'description': description,
                        'emails': [],
                        'phones': []
                    })
                
            except Exception as e:
                print(f"Error processing result {i+1}: {e}", file=sys.stderr)
                continue
        
        print(f"Successfully extracted {len(results)} authentic results", file=sys.stderr)
        return results

    def _is_search_result_link(self, link):
        """Check if a link appears to be a search result"""
        href = link.get('href', '')
        text = link.get_text(strip=True)
        
        # Skip obvious non-result links
        skip_patterns = [
            'yandex.ru/search', 'yandex.ru/images', 'yandex.ru/video',
            'javascript:', '#', 'mailto:', '/search?', 'yandex.ru/maps',
            'yandex.ru/news', 'yandex.ru/market'
        ]
        
        for pattern in skip_patterns:
            if pattern in href:
                return False
        
        return (len(text) > 10 and 
                href.startswith('http') and 
                'yandex.ru' not in href)

    def _clean_url(self, url):
        """Clean and validate URL"""
        if url.startswith('/url?'):
            # Handle Yandex redirect URLs
            try:
                from urllib.parse import parse_qs, urlparse
                parsed = urlparse(url)
                params = parse_qs(parsed.query)
                if 'url' in params:
                    url = params['url'][0]
                elif 'text' in params:
                    # Sometimes the URL is in the text parameter
                    text_param = params['text'][0]
                    if text_param.startswith('http'):
                        url = text_param
            except:
                pass
        elif url.startswith('//'):
            url = 'https:' + url
        elif url.startswith('/'):
            return None  # Skip relative URLs
        
        # Decode URL if needed
        try:
            url = unquote(url)
        except:
            pass
        
        if not url.startswith('http'):
            return None
            
        return url

    def _extract_description(self, result):
        """Extract description from search result"""
        desc_selectors = [
            '.VanillaReact-Text', '.OrganicText', '.serp-item__text',
            '.text', '.snippet', '.Organic-Text', '.content',
            '.organic__text'
        ]
        
        for sel in desc_selectors:
            desc_elem = result.select_one(sel)
            if desc_elem:
                desc = desc_elem.get_text(strip=True)
                if len(desc) > 20:
                    return desc[:400] + "..." if len(desc) > 400 else desc
        
        return ""

    def _extract_company_name(self, title, url):
        """Extract company name from title and URL"""
        company_name = title
        
        # Try to extract from title
        if ' - ' in title:
            company_name = title.split(' - ')[0]
        elif ' | ' in title:
            company_name = title.split(' | ')[0]
        elif ': ' in title:
            company_name = title.split(': ')[0]
        
        # Clean up
        company_name = company_name.strip()
        
        # If too long, try to get from URL
        if len(company_name) > 80:
            try:
                domain = urlparse(url).netloc
                if domain:
                    domain_parts = domain.replace('www.', '').split('.')
                    if domain_parts:
                        company_name = domain_parts[0].title()
            except:
                pass
        
        return company_name[:100] if len(company_name) > 100 else company_name

    def extract_company_details(self, url):
        """Extract authentic company information from real websites"""
        try:
            headers = self.get_random_headers()
            print(f"Extracting contacts from: {url}", file=sys.stderr)
            
            response = self.session.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract emails
            emails = set()
            email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            
            # Look in text content
            text_content = soup.get_text()
            found_emails = re.findall(email_pattern, text_content)
            emails.update(found_emails)
            
            # Look in mailto links
            mailto_links = soup.find_all('a', href=re.compile(r'^mailto:'))
            for link in mailto_links:
                email = link.get('href').replace('mailto:', '').split('?')[0]
                if '@' in email:
                    emails.add(email)
            
            # Extract phones
            phones = set()
            phone_patterns = [
                r'\+7[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}',
                r'8[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}',
                r'\+7[\s\-]*\d{10}',
                r'8[\s\-]*\d{10}'
            ]
            
            for pattern in phone_patterns:
                found_phones = re.findall(pattern, text_content)
                phones.update(found_phones)
            
            # Clean phones
            cleaned_phones = []
            for phone in phones:
                cleaned = re.sub(r'[^\d\+]', '', phone)
                if len(cleaned) >= 10:
                    cleaned_phones.append(phone)
            
            result = {
                'emails': list(emails)[:3],  # Limit to 3 emails
                'phones': cleaned_phones[:3]  # Limit to 3 phones
            }
            
            print(f"Extracted from {url}: {len(result['emails'])} emails, {len(result['phones'])} phones", file=sys.stderr)
            return result
            
        except Exception as e:
            print(f"Error extracting from {url}: {e}", file=sys.stderr)
            return {'emails': [], 'phones': []}

    def search_yandex_pages(self, keyword, region, language, include_ads, max_pages=10, progress_callback=None):
        """Search multiple pages of authentic Yandex results with enhanced anti-bot measures"""
        all_results = []
        region_code = self.get_region_code(region)
        
        # Try multiple search strategies
        search_strategies = [
            # Strategy 1: Direct search
            lambda k, r, l, a, p: self.build_yandex_url(k, r, l, a, p),
            # Strategy 2: Search without filters
            lambda k, r, l, a, p: f"https://yandex.ru/search/?text={quote(k)}&lr={r}",
            # Strategy 3: Mobile search
            lambda k, r, l, a, p: f"https://yandex.ru/search/touch/?text={quote(k)}&lr={r}",
            # Strategy 4: Alternative domain
            lambda k, r, l, a, p: f"https://yandex.com/search/?text={quote(k)}&lr={r}"
        ]
        
        for strategy_idx, strategy in enumerate(search_strategies):
            if all_results:  # Stop if we already found results
                break
                
            print(f"Trying search strategy {strategy_idx + 1}", file=sys.stderr)
            
            for page in range(min(max_pages, 2)):  # Limit to 2 pages per strategy
                if progress_callback:
                    progress_callback(f"Стратегия {strategy_idx + 1}, страница {page + 1}...", 
                                    int(25 + ((strategy_idx * 2 + page) / (len(search_strategies) * 2)) * 25))
                
                try:
                    url = strategy(keyword, region_code, language, include_ads, page)
                    headers = self.get_random_headers()
                    
                    # Add session cookies to appear more human
                    self.session.cookies.clear()
                    self.session.cookies.set('yandexuid', str(random.randint(1000000000, 9999999999)))
                    self.session.cookies.set('i', str(random.randint(1000000000, 9999999999)))
                    
                    print(f"Scraping page {page + 1} with strategy {strategy_idx + 1}: {url}", file=sys.stderr)
                    
                    # Longer timeout and retry logic
                    for attempt in range(3):
                        try:
                            response = self.session.get(url, headers=headers, timeout=20)
                            response.raise_for_status()
                            break
                        except Exception as retry_error:
                            if attempt == 2:
                                raise retry_error
                            print(f"Retry {attempt + 1} failed, trying again...", file=sys.stderr)
                            time.sleep(random.uniform(1, 3))
                    
                    print(f"Response status: {response.status_code}, content length: {len(response.text)}", file=sys.stderr)
                    
                    # Check for captcha or blocking
                    if 'captcha' in response.text.lower() or 'smartcaptcha' in response.text.lower():
                        print(f"Captcha detected with strategy {strategy_idx + 1}, trying next strategy", file=sys.stderr)
                        break
                    
                    if len(response.text) < 5000:
                        print(f"Response too small ({len(response.text)} chars), possible blocking", file=sys.stderr)
                        break
                    
                    results = self.extract_search_results(response.text, include_ads)
                    
                    if not results:
                        print(f"No results found on page {page + 1} with strategy {strategy_idx + 1}", file=sys.stderr)
                        if page == 0:  # If first page has no results, try next strategy
                            break
                        continue
                    
                    all_results.extend(results)
                    print(f"Found {len(results)} results on page {page + 1} with strategy {strategy_idx + 1}", file=sys.stderr)
                    
                    # Random delay to avoid rate limiting
                    delay = random.uniform(3, 7)
                    print(f"Waiting {delay:.1f} seconds before next page", file=sys.stderr)
                    time.sleep(delay)
                    
                except Exception as e:
                    print(f"Error on page {page + 1} with strategy {strategy_idx + 1}: {e}", file=sys.stderr)
                    break
            
            if all_results:
                print(f"Strategy {strategy_idx + 1} successful, found {len(all_results)} total results", file=sys.stderr)
                break
            else:
                # Delay between strategies
                delay = random.uniform(5, 10)
                print(f"Strategy {strategy_idx + 1} failed, waiting {delay:.1f} seconds before next strategy", file=sys.stderr)
                time.sleep(delay)
        
        print(f"Total authentic results from all strategies: {len(all_results)}", file=sys.stderr)
        return all_results

    def search_and_extract(self, keyword, regions, language, include_ads, max_pages=10, progress_callback=None):
        """Complete authentic search and extraction pipeline"""
        all_suppliers = []
        
        for i, region in enumerate(regions):
            if progress_callback:
                progress_callback(f"Поиск в регионе: {region}", int(10 + (i / len(regions)) * 40))
            
            # Search for authentic results
            results = self.search_yandex_pages(keyword, region, language, include_ads, max_pages, progress_callback)
            
            if not results:
                print(f"No authentic results found for {keyword} in {region}", file=sys.stderr)
                continue
            
            # Extract authentic contact details
            if progress_callback:
                progress_callback("Извлечение контактной информации...", 50)
            
            for j, result in enumerate(results):
                if progress_callback:
                    progress_callback(f"Обработка контактов {j+1}/{len(results)}...", 
                                    int(50 + (j / len(results)) * 25))
                
                # Extract authentic contact details from real websites
                contact_info = self.extract_company_details(result['url'])
                result['emails'] = contact_info['emails']
                result['phones'] = contact_info['phones']
                
                # Only add if we found authentic contact information
                if result['emails'] or result['phones']:
                    all_suppliers.append(result)
                    print(f"Added supplier: {result['company_name']}", file=sys.stderr)
                
                # Limit processing time per region
                if j >= 4:  # Process only first 5 results per region
                    break
        
        # Remove duplicates by URL
        seen_urls = set()
        unique_suppliers = []
        for supplier in all_suppliers:
            if supplier['url'] not in seen_urls:
                seen_urls.add(supplier['url'])
                unique_suppliers.append(supplier)
        
        print(f"Final authentic suppliers: {len(unique_suppliers)}", file=sys.stderr)
        return unique_suppliers

def main():
    """Main function for CLI usage"""
    parser = argparse.ArgumentParser(description='Authentic Yandex Search Scraper')
    parser.add_argument('--keyword', required=True, help='Search keyword')
    parser.add_argument('--regions', required=True, help='Comma-separated regions')
    parser.add_argument('--language', default='ru', help='Search language')
    parser.add_argument('--include-ads', action='store_true', help='Include ads in results')
    parser.add_argument('--max-pages', type=int, default=1, help='Maximum pages to search')
    
    args = parser.parse_args()
    
    def progress_callback(message, percent):
        print(f"[{percent}%] {message}", file=sys.stderr)
    
    scraper = AuthenticYandexSearchScraper()
    regions = [r.strip() for r in args.regions.split(',')]
    
    try:
        progress_callback(f"Поиск реальных поставщиков по запросу '{args.keyword}'...", 0)
        
        results = scraper.search_and_extract(
            args.keyword, 
            regions, 
            args.language, 
            args.include_ads, 
            args.max_pages, 
            progress_callback
        )
        
        progress_callback(f"Поиск завершен - найдено {len(results)} реальных поставщиков", 100)
        
        # Output JSON results
        print(json.dumps(results, ensure_ascii=False, indent=2))
        
    except Exception as e:
        progress_callback(f"Ошибка: {e}", 100)
        sys.exit(1)

if __name__ == "__main__":
    main()