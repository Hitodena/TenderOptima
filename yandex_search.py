#!/usr/bin/env python3
"""
Yandex Search Scraper for SupplierFinder
Searches Yandex for suppliers with comprehensive data extraction
"""

import requests
import time
import re
import json
import sys
from urllib.parse import urljoin, urlparse, quote
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
import trafilatura
from urllib.robotparser import RobotFileParser

class YandexSearchScraper:
    def __init__(self):
        self.ua = UserAgent()
        self.session = requests.Session()
        self.yandex_regions = {
            'Минск': 157,
            'Москва': 213,
            'Санкт-Петербург': 2,
            'Гомель': 155,
            'Брест': 153,
            'Витебск': 154,
            'Гродно': 156,
            'Могилев': 158,
            'Беларусь': 149,
            'Россия': 225,
            'Казахстан': 162,
            'Украина': 143
        }
        
    def get_region_code(self, region_name):
        """Get Yandex region code by name"""
        return self.yandex_regions.get(region_name, 213)  # Default to Moscow
    
    def build_yandex_url(self, keyword, region_code, language, include_ads, page=0):
        """Build Yandex search URL with all parameters"""
        base_url = "https://yandex.ru/search/"
        params = {
            'text': keyword,
            'lr': region_code,
            'lang': 'ru' if language == 'русский' else 'en',
            'p': page  # Page number (0-based)
        }
        
        # Add ads exclusion parameter if needed
        if not include_ads:
            params['filter'] = 'strict'  # Filter commercial results
            
        # Build URL manually for better control
        param_string = '&'.join([f"{k}={quote(str(v))}" for k, v in params.items()])
        return f"{base_url}?{param_string}"
    
    def get_random_headers(self):
        """Generate random headers to avoid detection"""
        return {
            'User-Agent': self.ua.random,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        }
    
    def extract_search_results(self, html_content, include_ads=True):
        """Extract search results from Yandex HTML"""
        soup = BeautifulSoup(html_content, 'html.parser')
        results = []
        
        # Multiple selectors for different Yandex layouts
        result_selectors = [
            '.serp-item',
            '.organic',
            '.search-result',
            '[data-cid]'
        ]
        
        found_results = []
        for selector in result_selectors:
            found_results.extend(soup.select(selector))
            
        for result in found_results:
            try:
                # Skip ads if not requested
                if not include_ads:
                    if any(cls in str(result.get('class', [])) for cls in ['commercial', 'adv', 'direct']):
                        continue
                
                # Extract title
                title_elem = result.select_one('h2 a, .organic__title a, .serp-item__title a')
                if not title_elem:
                    continue
                    
                title = title_elem.get_text(strip=True)
                url = title_elem.get('href', '')
                
                # Clean Yandex redirect URLs
                if url.startswith('/url?'):
                    url_params = url.split('url=')[-1].split('&')[0]
                    from urllib.parse import unquote
                    url = unquote(url_params)
                elif url.startswith('//'):
                    url = 'https:' + url
                
                # Extract description
                desc_elem = result.select_one('.organic__text, .serp-item__text, .text-container')
                description = desc_elem.get_text(strip=True) if desc_elem else ""
                
                # Basic validation
                if url and title and 'yandex.ru' not in url:
                    results.append({
                        'title': title,
                        'url': url,
                        'description': description[:200] + "..." if len(description) > 200 else description
                    })
                    
            except Exception as e:
                print(f"Error extracting result: {e}")
                continue
                
        return results
    
    def search_yandex_pages(self, keyword, region, language, include_ads, max_pages=10, progress_callback=None):
        """Search multiple pages of Yandex results"""
        region_code = self.get_region_code(region)
        all_results = []
        
        for page in range(max_pages):
            try:
                if progress_callback:
                    progress_callback(f"Поиск в Yandex страница {page + 1} из {max_pages}...", 
                                    int((page / max_pages) * 50))  # 50% for search phase
                
                url = self.build_yandex_url(keyword, region_code, language, include_ads, page)
                headers = self.get_random_headers()
                
                response = self.session.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                
                page_results = self.extract_search_results(response.text, include_ads)
                
                if not page_results:
                    print(f"No results found on page {page + 1}, stopping search")
                    break
                    
                all_results.extend(page_results)
                
                # Random delay to avoid rate limiting
                time.sleep(1 + (page * 0.5))  # Increasing delay for later pages
                
            except Exception as e:
                print(f"Error searching page {page + 1}: {e}")
                continue
                
        return all_results
    
    def extract_company_details(self, url):
        """Extract detailed company information from website"""
        try:
            headers = self.get_random_headers()
            response = self.session.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Use trafilatura for main content
            main_text = trafilatura.extract(response.text)
            
            # Parse HTML for additional data
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract emails using regex
            email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            emails = list(set(re.findall(email_pattern, response.text, re.IGNORECASE)))
            
            # Extract phone numbers (international and local formats)
            phone_patterns = [
                r'\+\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}',  # +375 (29) 123-45-67
                r'\d{3}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}',  # 123-45-67-89
                r'\(\d{3}\)[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}',  # (029) 123-45-67
            ]
            
            phones = []
            for pattern in phone_patterns:
                phones.extend(re.findall(pattern, response.text))
            phones = list(set(phones))
            
            # Extract company name from title or h1
            company_name = ""
            title_elem = soup.find('title')
            if title_elem:
                company_name = title_elem.get_text(strip=True)
            
            h1_elem = soup.find('h1')
            if h1_elem and len(h1_elem.get_text(strip=True)) < len(company_name):
                company_name = h1_elem.get_text(strip=True)
            
            # Clean company name
            if company_name:
                # Remove common suffixes
                for suffix in [' - Главная', ' | Главная страница', ' - Home', ' | Home']:
                    company_name = company_name.replace(suffix, '')
                company_name = company_name[:100]  # Limit length
            
            # Create description from main text
            description = ""
            if main_text:
                # Take first meaningful paragraph
                sentences = main_text.split('.')[:3]
                description = '. '.join(sentences)[:300]
                if len(description) < len(main_text[:300]):
                    description = main_text[:300]
            
            return {
                'url': url,
                'company_name': company_name,
                'description': description,
                'emails': emails[:3],  # Limit to 3 emails
                'phones': phones[:3]   # Limit to 3 phones
            }
            
        except Exception as e:
            print(f"Error extracting details from {url}: {e}")
            return {
                'url': url,
                'company_name': "",
                'description': "",
                'emails': [],
                'phones': []
            }
    
    def search_and_extract(self, keyword, regions, language, include_ads, max_pages=10, progress_callback=None):
        """Complete search and extraction pipeline"""
        all_suppliers = []
        
        # Use first region if multiple provided
        region = regions[0] if regions else "Минск"
        
        # Phase 1: Search Yandex
        search_results = self.search_yandex_pages(
            keyword, region, language, include_ads, max_pages, progress_callback
        )
        
        if not search_results:
            if progress_callback:
                progress_callback("Поиск завершен - результаты не найдены", 100)
            return []
        
        # Phase 2: Extract company details
        total_results = len(search_results)
        
        for i, result in enumerate(search_results[:50]):  # Limit to 50 companies to avoid timeout
            try:
                if progress_callback:
                    progress = 50 + int((i / min(total_results, 50)) * 50)  # 50-100% for extraction
                    progress_callback(f"Извлечение данных компаний... ({i + 1} из {min(total_results, 50)})", progress)
                
                company_details = self.extract_company_details(result['url'])
                
                # Merge search result with detailed data
                supplier = {
                    'url': result['url'],
                    'company_name': company_details['company_name'] or result['title'],
                    'description': company_details['description'] or result['description'],
                    'emails': company_details['emails'],
                    'phones': company_details['phones']
                }
                
                # Only add if we have at least email or phone
                if supplier['emails'] or supplier['phones']:
                    all_suppliers.append(supplier)
                
                # Delay between extractions
                time.sleep(1)
                
            except Exception as e:
                print(f"Error processing result {i}: {e}")
                continue
        
        if progress_callback:
            progress_callback(f"Поиск завершен - найдено {len(all_suppliers)} поставщиков", 100)
        
        return all_suppliers

def main():
    """Main function for CLI usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Yandex Search Scraper for SupplierFinder')
    parser.add_argument('--keyword', required=True, help='Search keyword')
    parser.add_argument('--regions', required=True, help='Comma-separated list of regions')
    parser.add_argument('--language', default='ru', help='Search language (ru or en)')
    parser.add_argument('--include-ads', action='store_true', help='Include ads in search')
    parser.add_argument('--max-pages', type=int, default=1, help='Maximum pages to search')
    
    args = parser.parse_args()
    
    keyword = args.keyword
    regions = args.regions.split(',')
    language = args.language
    include_ads = args.include_ads
    max_pages = args.max_pages
    
    def progress_callback(message, percent):
        print(f"[{percent}%] {message}")
    
    scraper = YandexSearchScraper()
    results = scraper.search_and_extract(
        keyword, regions, language, include_ads, max_pages, progress_callback
    )
    
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()