#!/usr/bin/env python3
"""
Demo Yandex Search Scraper for SupplierFinder
Provides realistic sample data for demonstration purposes
"""

import json
import sys
import time
import random

def generate_demo_results(keyword, regions, language, include_ads, max_pages):
    """Generate realistic demo search results based on parameters"""
    
    # Sample company data based on common search terms
    sample_companies = {
        'строительные материалы': [
            {
                'company_name': 'ООО "СтройМатериалы Плюс"',
                'url': 'https://stroy-materials-plus.ru',
                'description': 'Поставка строительных материалов, инструментов и оборудования по всей России. Опт и розница.',
                'emails': ['info@stroy-materials-plus.ru', 'sales@stroy-materials-plus.ru'],
                'phones': ['+7 (495) 123-45-67', '+7 (800) 555-01-23']
            },
            {
                'company_name': 'Торговый дом "Стройресурс"',
                'url': 'https://stroyresurs.ru',
                'description': 'Широкий ассортимент строительных материалов от ведущих производителей. Доставка по регионам.',
                'emails': ['td@stroyresurs.ru'],
                'phones': ['+7 (812) 987-65-43']
            },
            {
                'company_name': 'ООО "МетИзделия"',
                'url': 'https://metizdeliya.com',
                'description': 'Производство и поставка метизов, крепежных изделий, инструментов для строительства.',
                'emails': ['order@metizdeliya.com', 'info@metizdeliya.com'],
                'phones': ['+7 (383) 555-78-90']
            }
        ],
        'перчатки': [
            {
                'company_name': 'ООО "РабочаяЗащита"',
                'url': 'https://rabochaya-zashita.ru',
                'description': 'Производство и поставка рабочих перчаток, спецодежды и средств индивидуальной защиты.',
                'emails': ['sales@rabochaya-zashita.ru'],
                'phones': ['+7 (495) 777-88-99']
            },
            {
                'company_name': 'ПромПерчатки Групп',
                'url': 'https://prom-perchatki.ru',
                'description': 'Широкий ассортимент защитных перчаток для всех видов работ. Оптовые поставки.',
                'emails': ['info@prom-perchatki.ru', 'opt@prom-perchatki.ru'],
                'phones': ['+7 (812) 333-22-11', '+7 (800) 100-20-30']
            },
            {
                'company_name': 'СИЗ Центр',
                'url': 'https://siz-center.com',
                'description': 'Комплексные поставки средств индивидуальной защиты, включая перчатки всех типов.',
                'emails': ['order@siz-center.com'],
                'phones': ['+7 (383) 444-55-66']
            }
        ],
        'оборудование': [
            {
                'company_name': 'ТехноМаш',
                'url': 'https://technomash.ru',
                'description': 'Поставка промышленного оборудования и запчастей. Сервисное обслуживание.',
                'emails': ['sales@technomash.ru', 'service@technomash.ru'],
                'phones': ['+7 (495) 666-77-88']
            },
            {
                'company_name': 'Индустриальные Системы',
                'url': 'https://ind-systems.ru',
                'description': 'Комплексные решения в области промышленного оборудования и автоматизации.',
                'emails': ['info@ind-systems.ru'],
                'phones': ['+7 (812) 111-22-33']
            }
        ]
    }
    
    # Find matching companies based on keyword
    results = []
    keyword_lower = keyword.lower()
    
    # Direct match
    if keyword_lower in sample_companies:
        results = sample_companies[keyword_lower][:max_pages]
    else:
        # Partial matching
        for search_term, companies in sample_companies.items():
            if any(word in search_term for word in keyword_lower.split()):
                results.extend(companies)
        
        # If no matches, provide generic results
        if not results:
            results = [
                {
                    'company_name': f'ООО "Поставщик {keyword}"',
                    'url': f'https://supplier-{keyword.replace(" ", "-")}.ru',
                    'description': f'Поставка товаров и услуг по запросу "{keyword}". Работаем по всей России.',
                    'emails': [f'info@supplier-{keyword.replace(" ", "-")}.ru'],
                    'phones': ['+7 (495) 999-88-77']
                }
            ]
    
    return results[:max_pages]

def main():
    """Main function for CLI usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Demo Yandex Search Scraper for SupplierFinder')
    parser.add_argument('--keyword', required=True, help='Search keyword')
    parser.add_argument('--regions', required=True, help='Comma-separated list of regions')
    parser.add_argument('--language', default='ru', help='Search language (ru or en)')
    parser.add_argument('--include-ads', action='store_true', help='Include ads in search')
    parser.add_argument('--max-pages', type=int, default=3, help='Maximum pages to search')
    
    args = parser.parse_args()
    
    keyword = args.keyword
    regions = args.regions.split(',')
    language = args.language
    include_ads = args.include_ads
    max_pages = args.max_pages
    
    # Simulate search progress
    print(f"[0%] Поиск в Yandex по запросу '{keyword}'...")
    time.sleep(0.5)
    
    print(f"[25%] Обработка страницы 1 из {max_pages}...")
    time.sleep(0.3)
    
    print(f"[50%] Извлечение контактной информации...")
    time.sleep(0.4)
    
    print(f"[75%] Проверка email адресов...")
    time.sleep(0.3)
    
    # Generate demo results
    results = generate_demo_results(keyword, regions, language, include_ads, max_pages)
    
    print(f"[100%] Поиск завершен - найдено {len(results)} поставщиков")
    
    # Output results as JSON
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()