import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from loguru import logger
from pydantic import BaseModel

from .orchestrator import main_search

load_dotenv()

google_api = os.getenv("GOOGLE_SEARCH_API_TOKEN", "")
google_id = os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", "")
yandex_key_path = os.getenv("YANDEX_KEY_PATH", "")
yandex_folder = os.getenv("YANDEX_FOLDER_ID", "")

if not all([google_api, google_id, yandex_key_path, yandex_folder]):
    logger.error("Google API credentials not configured")
    raise RuntimeError(
        "GOOGLE_SEARCH_API_TOKEN and GOOGLE_CUSTOM_SEARCH_ENGINE_ID must be set"
    )


yandex_key_file = Path(yandex_key_path)

logger.remove()

logger.add(
    sink=lambda msg: print(msg, end=""),
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO",
    colorize=True,
)

logger.add(
    "logs/parser.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="WARNING",
    rotation="10 MB",
    retention="1 week",
)

app = FastAPI(
    title=os.getenv("API_TITLE", "Supplier Parser API"),
    version=os.getenv("API_VERSION", "1.0.0"),
    description=os.getenv(
        "API_DESCRIPTION", "API for searching suppliers via Google and Yandex"
    ),
)


class SearchRequest(BaseModel):
    query: str
    elements: int
    user_id: str
    region: str


class SearchResponse(BaseModel):
    results: list[dict]
    message: str = "Search completed"


@app.get("/")
async def root():
    return {"status": "ok"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "google_api_configured": bool(os.getenv("GOOGLE_SEARCH_API_TOKEN")),
        "google_cse_configured": bool(
            os.getenv("GOOGLE_CUSTOM_SEARCH_ENGINE_ID")
        ),
        "yandex_api_configured": bool(os.getenv("YANDEX_KEY_PATH")),
        "yandex_folder_configured": bool(os.getenv("YANDEX_FOLDER_ID")),
    }


@app.post("/search", response_model=SearchResponse)
async def search_endpoint(request: SearchRequest):
    try:
        logger.info(
            f"Received search request: query='{request.query}', elements={request.elements}, user_id={request.user_id}, region={request.region}"
        )

        if yandex_key_file and not yandex_folder:
            logger.warning("Yandex key file provided but folder ID missing")
        elif not yandex_key_file and yandex_folder:
            logger.warning("Yandex folder ID provided but key file missing")

        results = await main_search(
            query=request.query,
            user_id=request.user_id,
            elements=request.elements,
            region=request.region,
            google_search_api=google_api,
            google_search_id=google_id,
            yandex_key_file=yandex_key_file,
            yandex_folder_id=yandex_folder,
            excluded_domains=[],
        )

        logger.info(
            f"Search completed: found {len(results)} suppliers with contact information"
        )

        return SearchResponse(
            results=results,
            message=f"Found {len(results)} suppliers with contact information",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
