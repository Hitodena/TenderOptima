from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List

import pandas as pd
from pandas.errors import EmptyDataError

from .logger import CustomLogger

logger = CustomLogger("SavingModule", "SavingModule.log", debug=True, console=True).get_logger()
cache_pattern = "cache_{query}_{date}.csv"  # YYYY-MM-DD


def save_to_csv(data: List[Dict], filename: Path) -> None:
    """
    Save parsed results to a CSV file.

    Args:
        data (List[Dict]): Parsed data rows.
        filename (Path): Output CSV path.
    """

    if data is None:
        logger.error("Empty input data")
        return None

    dest = filename.parent / "data.csv"
    df = pd.DataFrame(data)
    write_header = not dest.exists()
    df.to_csv(dest, mode="a", index=False, header=write_header)
    logger.info(f"Appended {len(data)} records to {dest}")


def get_today_cache_path(query: str, data_dir: Path) -> Path:
    date_str = datetime.now().strftime("%Y-%m-%d")
    filename = cache_pattern.format(query=query, date=date_str)
    return data_dir / filename


def cleanup_old_caches(query: str, data_dir: Path, keep_days: int = 1) -> None:
    cutoff = datetime.now() - timedelta(days=keep_days)
    for f in data_dir.glob(f"cache_{query}_*.csv"):
        try:
            date_part = f.stem.rsplit("_", 1)[1]
            file_date = datetime.strptime(date_part, "%Y-%m-%d")
            if file_date < cutoff:
                f.unlink()
        except Exception:
            continue


def load_cache(query: str, cache_file: Path, data_dir: Path) -> List[Dict]:
    """
    Load cached results for a given query from CACHE_FILE.

    Args:
        query (str): Search query to look up.

    Returns:
        List[Dict]: Cached rows (may be empty list).
    """
    cleanup_old_caches(query, data_dir)
    cache_file = get_today_cache_path(query, data_dir)
    if not cache_file.exists():
        return []
    df = pd.read_csv(cache_file)
    df_q = df[df["query"] == query]
    return df_q.to_dict(orient="records") if not df_q.empty else []


def update_cache(rows: List[Dict], cache_file: Path, data_dir: Path, query: str) -> None:
    """
    Append new rows to the cache CSV.

    Args:
        rows (List[Dict]): Rows to append.
    """
    cache_file = get_today_cache_path(query, data_dir)
    write_header = not cache_file.exists()
    df_new = pd.DataFrame(rows)
    df_new.to_csv(cache_file, mode="a", index=False, header=write_header)
    logger.info(f"Appended {len(rows)} rows to cache {cache_file.name}")