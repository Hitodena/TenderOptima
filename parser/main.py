"""
FastAPI entrypoint — Supplier Parser API (Yandex-only edition).
"""

import os
import sys
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from loguru import logger
from pydantic import BaseModel

from .orchestrator import main_search

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

console_format: str = (
    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
    "<level>{level}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
    "<level>{message}</level>"
    " <dim>({extra})</dim>"
)

logger.remove()
logger.add(
    sys.stderr,
    level="INFO",
    format=console_format,
    colorize=True,
    backtrace=True,
    enqueue=True,
)


# ---------------------------------------------------------------------------
# Env / credentials
# ---------------------------------------------------------------------------

load_dotenv()

YANDEX_API_KEY: str = os.getenv("YANDEX_API_KEY", "")
YANDEX_FOLDER_ID: str = os.getenv("YANDEX_FOLDER_ID", "")

if not YANDEX_API_KEY or not YANDEX_FOLDER_ID:
    logger.error("Yandex credentials must be set in environment")
    raise RuntimeError("Missing required Yandex credentials")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title=os.getenv("API_TITLE", "Supplier Parser API"),
    version=os.getenv("API_VERSION", "1.0.0"),
    description="Search suppliers via Yandex and extract contact information.",
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SearchRequest(BaseModel):
    query: str
    elements: int
    user_id: str
    region: str


class SearchResponse(BaseModel):
    results: list[dict]
    count: int
    message: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/")
async def root() -> dict:
    return {"status": "ok"}


@app.get("/health")
async def health_check() -> dict:
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "yandex_api_configured": bool(YANDEX_API_KEY),
        "yandex_folder_configured": bool(YANDEX_FOLDER_ID),
    }


@app.post("/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest) -> SearchResponse:
    try:
        results = await main_search(
            query=request.query,
            user_id=request.user_id,
            elements=request.elements,
            region_name=request.region,
            yandex_api_key=YANDEX_API_KEY,
            yandex_folder_id=YANDEX_FOLDER_ID,
            excluded_domains=[],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unhandled error in /search")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return SearchResponse(
        results=results,
        count=len(results),
        message=f"Found {len(results)} suppliers with contact information",
    )
