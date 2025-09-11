# search_manager.py

import asyncio
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlparse, urlunparse
from parsers.google_parser import parse_google
from parsers.yandex_parser import yandex_fetch_all
from utils.logger import CustomLogger

# ============ Configuration ============
logger = CustomLogger(
    logger_name="SearchManager", file_path="SearchManager.log", debug=True, console=True
).get_logger()

def normalize_link(link: str) -> str:
    parsed = urlparse(link)
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    # ИЗМЕНЕНО: Возвращаем только netloc для группировки по домену
    return netloc

async def fetch_all(
    query: str,
    user_id: str,
    elements: int,
    region: str,
    google_search_api: str,
    google_search_id: str,
    yandex_key_file: Path,
    yandex_folder_id: str,
) -> List[Dict]:
    """
    ИЗМЕНЕНО: Учитывает позицию при дедупликации и сортирует финальный результат.
    """
    logger.info(f"Starting search with query: '{query}', region: '{region}', elements: {elements}")

    # Временно отключаем Яндекс, так как он не возвращает позицию
    google_task = parse_google(
        query=query,
        elements=elements,
        region=region,
        user_id=user_id,
        token=google_search_api,
        cust=google_search_id,
    )
    logger.info("Google search task created.")
    yandex_task = None # Отключаем яндекс

    tasks = [task for task in [google_task, yandex_task] if task is not None]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    combined: List[Dict] = []
    for res in results:
        if isinstance(res, Exception):
            logger.error(f"A search task failed: {res}")
        elif res:
            combined.extend(res)

    if not combined:
        logger.warning("No results from any search engine; returning empty list.")
        return []

    # ИЗМЕНЕНО: Умная дедупликация с учетом позиции
    # seen будет хранить {нормализованный_домен: результат_с_лучшей_позицией}
    seen: Dict[str, Dict] = {}
    for item in combined:
        # Убедимся, что у всех элементов есть 'position', присваивая дефолтное значение для совместимости
        if 'position' not in item:
            item['position'] = 999  # Большое значение для элементов без ранга (например, из Яндекса в будущем)

        norm_domain = normalize_link(item.get("domain", ""))
        if not norm_domain:
            continue

        if norm_domain not in seen or item['position'] < seen[norm_domain]['position']:
            # Если домен встречен впервые ИЛИ у нового результата позиция лучше (меньше),
            # сохраняем/обновляем его
            seen[norm_domain] = item
        else:
            logger.debug(f"Duplicate skipped (worse rank): {item.get('domain')}")

    # Собираем уникальные результаты из словаря
    unique_results = list(seen.values())

    # ИЗМЕНЕНО: Финальная сортировка по позиции для восстановления порядка Google
    unique_results.sort(key=lambda x: x['position'])

    logger.info(f"Deduplicated and sorted results: {len(unique_results)} unique items.")

    return unique_results
