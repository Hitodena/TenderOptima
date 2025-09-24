import asyncio
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse, urlunparse

from parsers.google_parser import parse_google
from parsers.yandex_parser import yandex_fetch_all
from parsers.utils.logger import CustomLogger

# ============ Configuration ============

# Logger setup
logger = CustomLogger(
    logger_name="SearchManager", file_path="SearchManager.log", debug=False, console=True
).get_logger()


def normalize_link(link: str) -> str:
    """
    Normalize URL for deduplication: lowercase scheme and netloc,
    remove trailing slash, ignore query and fragment.
    """
    parsed = urlparse(link)
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    normalized = urlunparse((scheme, netloc, path, "", "", ""))
    return normalized


def build_exclusion_query(query: str, excluded_domains: List[str], search_engine: str) -> str:
    """
    Строит модифицированный поисковый запрос с исключениями доменов.
    
    Args:
        query: Оригинальный поисковый запрос
        excluded_domains: Список доменов для исключения
        search_engine: Поисковая система ("google" или "yandex")
    
    Returns:
        Модифицированный запрос с исключениями
    """
    if not excluded_domains:
        return query
    
    exclusions = []
    for domain in excluded_domains:
        # Очищаем домен от протокола и www
        clean_domain = domain.replace("https://", "").replace("http://", "").replace("www.", "")
        
        if search_engine == "google":
            exclusions.append(f"-site:{clean_domain}")
        elif search_engine == "yandex":
            exclusions.append(f"-site:{clean_domain}")
    
    if exclusions:
        modified_query = f"{query} {' '.join(exclusions)}"
        logger.info(f"Modified {search_engine} query: '{query}' -> '{modified_query}'")
        return modified_query
    
    return query


def get_yandex_region_code(region) -> int:
    """
    Convert region to Yandex region code.
    
    Args:
        region: Region string (e.g., 'ru', 'by', 'ua', 'kz'), 
                integer yandexId (e.g., 213 for Moscow), 
                or object with yandexId attribute
        
    Returns:
        Yandex region code (int)
    """
    region_mapping = {
        # СНГ и ближнее зарубежье
        'ru': 225,  # Россия
        'by': 149,  # Беларусь
        'ua': 187,  # Украина
        'kz': 159,  # Казахстан
        'uz': 166,  # Узбекистан (исправлено с 191)
        'kg': 164,  # Кыргызстан (исправлено с 118)
        'tj': 186,  # Таджикистан
        'tm': 189,  # Туркменистан
        'am': 169,  # Армения (исправлено с 7)
        'az': 10,   # Азербайджан
        'ge': 169,  # Грузия (исправлено с 35)
        'md': 139,  # Молдова
        
        # Города России (по yandexId)
        213: 213,  # Москва
        2: 2,      # Санкт-Петербург
        39: 39,    # Ростов-на-Дону
        43: 43,    # Казань
        47: 47,    # Нижний Новгород
        46: 46,    # Самара
        54: 54,    # Екатеринбург
        56: 56,    # Челябинск
        65: 65,    # Новосибирск
        66: 66,    # Омск
        
        # Федеральные округа России
        3: 3,      # Центральный ФО
        17: 17,    # Северо-Западный ФО
        35: 35,    # Южный ФО
        26: 26,    # Северо-Кавказский ФО
        41: 41,    # Приволжский ФО
        73: 73,    # Дальневосточный ФО
        
        # Европа
        'de': 132,  # Германия
        'fr': 148,  # Франция
        'gb': 12,   # Великобритания
        'it': 138,  # Италия
        'es': 137,  # Испания
        'pl': 142,  # Польша
        'nl': 140,  # Нидерланды
        'be': 131,  # Бельгия
        'at': 130,  # Австрия
        'ch': 154,  # Швейцария
        'se': 155,  # Швеция
        'no': 141,  # Норвегия
        'dk': 134,  # Дания
        'fi': 147,  # Финляндия
        'cz': 153,  # Чехия
        'hu': 135,  # Венгрия
        'ro': 144,  # Румыния
        'bg': 132,  # Болгария
        'hr': 150,  # Хорватия
        'si': 146,  # Словения
        'sk': 145,  # Словакия
        'lt': 114,  # Литва
        'lv': 115,  # Латвия
        'ee': 116,  # Эстония
        'gr': 133,  # Греция
        'pt': 143,  # Португалия
        'cy': 984,  # Кипр
        'rs': 11232, # Сербия
        'me': 11233, # Черногория
        
        # Азия
        'cn': 134,  # Китай
        'jp': 133,  # Япония
        'kr': 10758, # Южная Корея
        'in': 236,  # Индия
        'th': 118,  # Таиланд
        'il': 131,  # Израиль
        'ae': 971,  # ОАЭ
        'eg': 86,   # Египет
        
        # Америка
        'us': 84,   # США
        'ca': 104,  # Канада
        'br': 233,  # Бразилия
        
        # Океания
        'au': 129,  # Австралия
    }
    
    # Обрабатываем как строковые коды стран, так и числовые коды городов
    if isinstance(region, str):
        return region_mapping.get(region.lower(), 225)  # Default to Russia
    elif isinstance(region, int):
        return region_mapping.get(region, 225)  # Default to Russia
    else:
        # Если region - это объект с yandexId
        yandex_id = getattr(region, 'yandexId', None) or getattr(region, 'yandex_id', None)
        if yandex_id:
            return region_mapping.get(yandex_id, 225)
        return 225  # Default to Russia


async def fetch_all(
    query: str,
    user_id: str,
    elements: int,
    region: str,
    google_search_api: str,
    google_search_id: str,
    yandex_key_file: Path,
    yandex_folder_id: str,
    sources: dict = {},
    excluded_domains: List[str] = [],  # Восстанавливаем параметр стоп-листа
) -> List[Dict]:
    """
    Unified fetcher: queries Google and Yandex in parallel,
    merges and deduplicates results by normalized URL.

    Args:
        query (str): Search query.
        user_id (str): ID of the requesting user.
        elements (int): Total results.
        google_search_api (str): Google API token.
        google_search_id (str): Google CSE ID.
        yandex_key_file (Path): Path to Yandex key file.
        yandex_folder_id (str): Yandex folder ID.

    Returns:
        List[Dict]: Deduplicated list of combined results.
    """
    # Check which search sources are enabled
    use_google = sources.get("google", True)  # default to True for backward compatibility
    use_yandex = sources.get("yandex", False)  # default to False for backward compatibility
    
    logger.info(f"Search sources: google={use_google}, yandex={use_yandex}")
    logger.info(f"Excluded domains: {excluded_domains}")
    
    # Строим модифицированные запросы с исключениями
    google_query = build_exclusion_query(query, excluded_domains, "google") if use_google else query
    # Отключаем исключения для Yandex - будем фильтровать после получения результатов
    yandex_query = query  # Используем оригинальный запрос без исключений
    
    # Concurrently fetch from enabled engines
    google_task = None
    if use_google and google_search_api and google_search_id:
        google_task = parse_google(
            query=google_query,  # Используем модифицированный запрос
            elements=elements,
            region=region,
            user_id=user_id,
            token=google_search_api,
            cust=google_search_id,
        )
    
    yandex_task = None
    if use_yandex and yandex_key_file and yandex_folder_id:
        # Convert region string to Yandex region code
        region_code = get_yandex_region_code(region)
        logger.info(f"Yandex search with region: {region} -> code: {region_code}")
        yandex_task = yandex_fetch_all(
            key_file=yandex_key_file,
            folder_id=yandex_folder_id,
            user_id=user_id,
            query=yandex_query,  # Используем модифицированный запрос
            total_results=elements,
            region=region_code,
        )

    tasks = [task for task in [google_task, yandex_task] if task is not None]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Merge
    combined: List[Dict] = []
    for res in results:
        if res and not isinstance(res, Exception):
            combined.extend(res)

    if not combined:
        logger.warning("No results from any engine; returning empty list.")
        return []

    # Deduplicate by normalized URL
    seen = set()
    unique_results: List[Dict] = []
    for item in combined:
        link = item.get("domain", "")
        norm = normalize_link(link)
        if norm not in seen:
            seen.add(norm)
            unique_results.append(item)
        else:
            logger.debug(f"Duplicate skipped: {link}")

    # Пост-фильтрация: исключаем домены из стоп-листа
    filtered_results: List[Dict] = []
    excluded_count = 0
    
    for item in unique_results:
        domain = item.get("domain", "")
        # Извлекаем чистый домен для сравнения
        clean_domain = domain.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
        
        # Проверяем, есть ли домен в стоп-листе
        is_excluded = False
        for excluded_domain in excluded_domains:
            excluded_clean = excluded_domain.replace("https://", "").replace("http://", "").replace("www.", "")
            if clean_domain == excluded_clean or clean_domain.endswith("." + excluded_clean):
                is_excluded = True
                excluded_count += 1
                logger.info(f"Excluded domain from results: {domain} (matches {excluded_domain})")
                break
        
        if not is_excluded:
            filtered_results.append(item)
    
    logger.info(f"Post-filtering: {len(filtered_results)} results after excluding {excluded_count} domains from stop-list")
    logger.info(f"Final results: {len(filtered_results)} unique out of {len(combined)} total")
    return filtered_results