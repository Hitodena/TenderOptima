import asyncio
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Union

import aiohttp

from parsers.info_getter import get_info
from parsers.search_manager import fetch_all
from parsers.utils.logger import CustomLogger
from parsers.utils import storage

logger = CustomLogger(
    logger_name="SupplierFinderParser", file_path="SupplierFinderParser.log", debug=True, console=True
).get_logger()

# Helpers
def normalize_domain(value: str) -> str:
    """
    Normalize domains/URLs so that `https://www.example.com/` and `example.com`
    are considered equal when we match contact info back to search results.
    """
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.startswith("http://"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("https://"):
        cleaned = cleaned[8:]
    if cleaned.startswith("www."):
        cleaned = cleaned[4:]
    return cleaned.rstrip("/")

def clean_text(text: str) -> str:
    """
    Удаляет эмодзи и специальные символы из текста (✅, ➦, и т.д.)
    """
    if not text:
        return ""
    
    # Удаляем эмодзи и специальные символы
    # Паттерн для удаления эмодзи и символов из категорий: Symbols, Pictographs, Supplemental Symbols and Pictographs
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags (iOS)
        "\U00002702-\U000027B0"  # dingbats
        "\U000024C2-\U0001F251"  # enclosed characters
        "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
        "\U0001FA00-\U0001FA6F"  # Chess Symbols
        "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
        "\U00002600-\U000026FF"  # Miscellaneous Symbols
        "\U00002700-\U000027BF"  # Dingbats
        "\U0001F018-\U0001F270"  # Various asian characters
        "\U0001F300-\U0001F5FF"  # Miscellaneous Symbols and Pictographs
        "\U0001F600-\U0001F64F"  # Emoticons
        "\U0001F680-\U0001F6FF"  # Transport and Map
        "\U0001F700-\U0001F77F"  # Alchemical Symbols
        "\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
        "\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
        "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
        "\U0001FA00-\U0001FA6F"  # Chess Symbols
        "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
        "\U00002600-\U000026FF"  # Miscellaneous Symbols
        "\U00002700-\U000027BF"  # Dingbats
        "]+",
        flags=re.UNICODE
    )
    
    # Удаляем эмодзи
    text = emoji_pattern.sub('', text)
    
    # Удаляем другие специальные символы (стрелки, галочки и т.д.)
    # ✅, ➦, ➤, ➜, ➝, ➞, ➟, ➠, ➡, ➢, ➣, ➤, ➥, ➦, ➧, ➨, ➩, ➪, ➫, ➬, ➭, ➮, ➯, ➰, ➱, ➲, ➳, ➴, ➵, ➶, ➷, ➸, ➹, ➺, ➻, ➼, ➽, ➾, ➿
    special_chars = [
        '✅', '❌', '✔', '✓', '✗', '✘', '➦', '➤', '➜', '➝', '➞', '➟', '➠', '➡', 
        '➢', '➣', '➥', '➧', '➨', '➩', '➪', '➫', '➬', '➭', '➮', '➯', '➰', '➱',
        '➲', '➳', '➴', '➵', '➶', '➷', '➸', '➹', '➺', '➻', '➼', '➽', '➾', '➿',
        '⭐', '🌟', '💫', '✨', '🔥', '💯', '🎯', '📌', '📍', '🔍', '🔎', '💡', '⚡',
        '🎉', '🎊', '🏆', '🥇', '🥈', '🥉', '💪', '👍', '👎', '❤', '💛', '💚', '💙',
        '💜', '🖤', '🤍', '🤎', '💔', '❣', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
        '💟', '☀', '☁', '☂', '☃', '☄', '★', '☆', '☇', '☈', '☉', '☊', '☋', '☌',
        '☍', '☎', '☏', '☐', '☑', '☒', '☓', '☔', '☕', '☖', '☗', '☘', '☙', '☚',
        '☛', '☜', '☝', '☞', '☟', '☠', '☡', '☢', '☣', '☤', '☥', '☦', '☧', '☨',
        '☩', '☪', '☫', '☬', '☭', '☮', '☯', '☰', '☱', '☲', '☳', '☴', '☵', '☶',
        '☷', '☸', '☹', '☺', '☻', '☼', '☽', '☾', '☿', '♀', '♁', '♂', '♃', '♄',
        '♅', '♆', '♇', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒',
        '♓', '♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟', '♠',
        '♡', '♢', '♣', '♤', '♥', '♦', '♧', '♨', '♩', '♪', '♫', '♬', '♭', '♮',
        '♯', '♰', '♱', '♲', '♳', '♴', '♵', '♶', '♷', '♸', '♹', '♺', '♻', '♼',
        '♽', '♾', '♿', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅', '⚆', '⚇', '⚈', '⚉', '⚊',
        '⚋', '⚌', '⚍', '⚎', '⚏', '⚐', '⚑', '⚒', '⚓', '⚔', '⚕', '⚖', '⚗', '⚘',
        '⚙', '⚚', '⚛', '⚜', '⚝', '⚞', '⚟', '⚠', '⚡', '⚢', '⚣', '⚤', '⚥', '⚦',
        '⚧', '⚨', '⚩', '⚪', '⚫', '⚬', '⚭', '⚮', '⚯', '⚰', '⚱', '⚲', '⚳', '⚴',
        '⚵', '⚶', '⚷', '⚸', '⚹', '⚺', '⚻', '⚼', '⚽', '⚾', '⚿', '⛀', '⛁', '⛂',
        '⛃', '⛄', '⛅', '⛆', '⛇', '⛈', '⛉', '⛊', '⛋', '⛌', '⛍', '⛎', '⛏', '⛐',
        '⛑', '⛒', '⛓', '⛔', '⛕', '⛖', '⛗', '⛘', '⛙', '⛚', '⛛', '⛜', '⛝', '⛞',
        '⛟', '⛠', '⛡', '⛢', '⛣', '⛤', '⛥', '⛦', '⛧', '⛨', '⛩', '⛪', '⛫', '⛬',
        '⛭', '⛮', '⛯', '⛰', '⛱', '⛲', '⛳', '⛴', '⛵', '⛶', '⛷', '⛸', '⛹', '⛺',
        '⛻', '⛼', '⛽', '⛾', '⛿'
    ]
    
    for char in special_chars:
        text = text.replace(char, '')
    
    # Удаляем множественные пробелы
    text = re.sub(r'\s+', ' ', text)
    
    # Удаляем пробелы в начале и конце
    return text.strip()

# Configuration
MAX_CONCURRENT_REQUESTS = 10
DEFAULT_ELEMENTS = 50
DEFAULT_REGION = "ru"
DATA_DIR = Path(__file__).resolve().parent / "data"


async def main_search(
    query: str,
    user_id: str = "1",
    elements: int = DEFAULT_ELEMENTS,
    region: Union[str, dict] = DEFAULT_REGION,
    google_search_api: Optional[str] = None,
    google_search_id: Optional[str] = None,
    yandex_key_file: Optional[Path] = None,
    yandex_folder_id: Optional[str] = None,
    sources: dict = {},
    excluded_domains: List[str] = [],  # Восстанавливаем параметр стоп-листа
) -> List[Dict]:
    """
    Main search function that orchestrates Google and Yandex searches with contact extraction.
    
    Args:
        query: Search query
        user_id: User identifier
        elements: Number of results to fetch
        region: Search region
        google_search_api: Google API key
        google_search_id: Google Custom Search Engine ID
        yandex_key_file: Path to Yandex service account key file
        yandex_folder_id: Yandex Cloud folder ID
    
    Returns:
        List of enriched supplier data with contact information
    """
    logger.info(f"Starting search for query: '{query}' with {elements} elements, excluding {len(excluded_domains)} domains")
    
    # Validate API credentials
    has_google = google_search_api and google_search_id
    has_yandex = yandex_key_file and yandex_folder_id
    
    if not has_google and not has_yandex:
        logger.error("No valid API credentials provided")
        return []
    
    # Step 1: Search for domains using Google and/or Yandex
    try:
        # Ensure we have values for all parameters
        google_api = google_search_api or ""
        google_id = google_search_id or ""
        yandex_key = yandex_key_file or Path("dummy")
        yandex_folder = yandex_folder_id or ""
        
        search_results = await fetch_all(
            query=query,
            user_id=user_id,
            elements=elements,
            region=region,
            google_search_api=google_api,
            google_search_id=google_id,
            yandex_key_file=yandex_key,
            yandex_folder_id=yandex_folder,
            sources=sources,
            excluded_domains=excluded_domains,  # Передаем стоп-лист в fetch_all
        )
        
        if not search_results:
            logger.warning("No search results found")
            return []
            
        logger.info(f"Found {len(search_results)} domains from search engines (after query-level exclusions)")
        
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []
    
    # Step 2: Extract contact information
    try:
        domains = [result["domain"] for result in search_results]
        
        # Setup for contact extraction
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        connector = aiohttp.TCPConnector(limit=100, ttl_dns_cache=300, use_dns_cache=True)
        
        # Get contact information
        contact_results = await get_info(domains, MAX_CONCURRENT_REQUESTS)
        
        logger.info(f"Extracted contacts from {len(contact_results)} domains")
        
    except Exception as e:
        logger.error(f"Contact extraction failed: {e}")
        contact_results = []
    
    # Step 3: Merge search results with contact information
    enriched_results = []
    contact_map = {normalize_domain(result["domain"]): result for result in contact_results}
    
    # Логирование отключено для ускорения вывода результатов
    
    def is_relevant_email(address: str) -> bool:
        if not address:
            return False
        
        # Извлекаем локальную часть (до @) и домен
        parts = address.split('@')
        if len(parts) != 2:
            return False
        local_part = parts[0].lower()
        domain_part = parts[1].lower()
        
        # Проверка 0: Фильтруем известные технические домены
        technical_domains = ['receive-sentry', 'sentry', 'noreply', 'no-reply', 'donotreply', 
                            'mailer-daemon', 'postmaster', 'automated', 'system', 'prom-errors',
                            'errors', 'error', 'evorun', 'evo.run', 'evo', 'prom']
        for tech_domain in technical_domains:
            if tech_domain in domain_part:
                logger.info(f"❌ Filtered email (technical domain '{tech_domain}'): {address}")
                return False
        
        # Проверка 1: СТРОГОЕ правило - если в email больше 10 цифр, отфильтровываем
        digits_total = sum(ch.isdigit() for ch in address)
        if digits_total > 10:
            logger.info(f"❌ Filtered email (>10 digits: {digits_total}): {address}")
            return False
        
        # Проверка 2: Длинная локальная часть с большим количеством цифр
        digits_local = sum(ch.isdigit() for ch in local_part)
        if len(local_part) >= 16 and digits_local >= 6:
            logger.info(f"❌ Filtered email (long local part with >=6 digits): {address}")
            return False
        
        # Проверка 3: Локальная часть состоит почти полностью из hex-символов (технические email)
        hex_chars = set('0123456789abcdef')
        cleaned_local = local_part.replace('-', '').replace('_', '')
        if len(cleaned_local) >= 20:
            hex_ratio = sum(1 for ch in cleaned_local if ch in hex_chars) / len(cleaned_local)
            if hex_ratio >= 0.85:  # 85% и более hex-символов (снижено с 90% для более строгой фильтрации)
                logger.info(f"❌ Filtered email (hex-like technical email, {hex_ratio:.1%} hex): {address}")
                return False
        
        # Проверка 4: Очень длинная локальная часть (>=30 символов) - вероятно технический email
        if len(local_part) >= 30:
            logger.info(f"❌ Filtered email (very long local part >=30): {address}")
            return False
        
        # Проверка 5: Локальная часть состоит только из hex-символов и длиннее 20 символов
        if len(local_part) >= 20:
            if all(ch in hex_chars or ch in '-_' for ch in local_part):
                hex_only = sum(1 for ch in local_part if ch in hex_chars)
                if hex_only >= 20:  # Почти все символы hex (снижено с 24 для более строгой фильтрации)
                    logger.info(f"❌ Filtered email (long hex-only local part, {hex_only} hex chars): {address}")
                    return False
        
        # Проверка 6: Слишком много подряд идущих hex-символов без разделителей
        if len(local_part) >= 20:
            # Проверяем, есть ли хотя бы одна буква (не hex) или разделитель
            has_non_hex = any(ch not in hex_chars and ch not in '-_.' for ch in local_part)
            if not has_non_hex and len(local_part) >= 20:
                logger.info(f"❌ Filtered email (only hex chars, no separators): {address}")
                return False
        
        logger.debug(f"✅ Email passed all filters: {address}")
        return True
    
    for search_result in search_results:
        domain = search_result["domain"]
        normalized_domain = normalize_domain(domain)
        contact_info = contact_map.get(normalized_domain, {})
        
        # Логирование отключено для ускорения вывода результатов
        
        # Only include suppliers with valid email addresses
        raw_emails = contact_info.get("emails", [])
        emails = []
        for email in raw_emails:
            if is_relevant_email(email):
                emails.append(email)
        # Логирование фильтрации email отключено для ускорения
        
        # Если все email отфильтрованы, пропускаем этого поставщика
        if not emails:
            logger.info(f"❌ Отбрасываем домен '{domain}', так как все email отфильтрованы. Было {len(raw_emails)} email.")
            continue
        
        phones = contact_info.get("phones", [])
        
        if emails:  # Only save suppliers with authentic email addresses
            # Объединяем meta description, title страницы и описание
            # ЛОГИКА КАК В СТАРОЙ ВЕРСИИ (TEMP_CHANGES_BACKUP.md), но с добавлением meta_description
            meta_description = contact_info.get("meta_description", "")
            page_title = contact_info.get("page_title", "")
            original_description = search_result.get("description", "")
            
            # Очищаем текст от эмодзи и специальных символов
            page_title = clean_text(page_title) if page_title else ""
            original_description = clean_text(original_description) if original_description else ""
            
            # Формируем финальное описание: page_title + original_description
            # ПОРЯДОК: page_title ПЕРВЫМ, затем original_description
            # meta_description СКРЫТ (но код оставлен для возможного использования в будущем)
            description_parts = []
            
            # 1. Добавляем page_title ПЕРВЫМ (если есть)
            if page_title:
                description_parts.append(page_title)
            
            # 2. meta_description СКРЫТ - не добавляем в описание (код оставлен для возможного использования)
            # if meta_description:
            #     description_parts.append(meta_description)
            
            # 3. Добавляем original_description (если есть) - это то описание, которое всегда было ранее
            if original_description:
                description_parts.append(original_description)
            
            # Объединяем все части
            if description_parts:
                final_description = ". ".join(description_parts)
            else:
                # Fallback: используем только page_title или original_description (meta_description исключен)
                final_description = page_title or original_description or ""
            
            # Ограничиваем длину описания
            if len(final_description) > 800:
                final_description = final_description[:800].rsplit(' ', 1)[0] + "..."
            
            enriched_result = {
                "user_id": search_result["user_id"],
                "query": search_result["query"],
                "domain": search_result["domain"],
                "description": final_description,
                "engine": search_result["engine"],
                "emails": emails,
                "phones": phones,
                "dateOfSearch": datetime.now().isoformat(),
                "page_title": page_title,
            }
            enriched_results.append(enriched_result)
            logger.info(f"✅ Домен '{domain}' добавлен с email: {emails}")
    
    logger.info(f"Final results: {len(enriched_results)} suppliers with authentic contact information")
    
    # Step 4: Save results if any found
    if enriched_results:
        DATA_DIR.mkdir(exist_ok=True)
        storage.save_to_csv(enriched_results, DATA_DIR / "results.csv")
    
    return enriched_results


if __name__ == "__main__":
    # Example usage
    if len(sys.argv) < 2:
        print("Usage: python main.py 'search query' [elements] [user_id]")
        sys.exit(1)
    
    query = sys.argv[1]
    elements = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_ELEMENTS
    user_id = sys.argv[3] if len(sys.argv) > 3 else "1"
    
    # Load environment variables for API keys     
    google_api = os.getenv("GOOGLE_SEARCH_API_TOKEN")
    google_id = os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
    yandex_key_path = os.getenv("YANDEX_KEY_PATH")
    yandex_folder = os.getenv("YANDEX_FOLDER_ID")
    
    yandex_key_file = Path(yandex_key_path) if yandex_key_path else None
    
    # Run the search
    results = asyncio.run(
        main_search(
            query=query,
            user_id=user_id,
            elements=elements,
            google_search_api=google_api,
            google_search_id=google_id,
            yandex_key_file=yandex_key_file,
            yandex_folder_id=yandex_folder,
        )
    )
    
    print(f"Search completed. Found {len(results)} suppliers with contact information.")
    for result in results:
        print(f"- {result['domain']}: {len(result['emails'])} emails, {len(result['phones'])} phones")