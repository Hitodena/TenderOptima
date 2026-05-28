from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import api_router
from backend.core.config import get_config
from backend.core.logging_settings import LoggerSettings
from backend.services.db_service import db_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = get_config()

    LoggerSettings(config).setup_logger()
    db_manager.init(config.build_db_url())

    yield

    await db_manager.close()


config = get_config()
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=config.cors_allow_credentials,
    allow_methods=config.cors_allow_methods.split(","),
    allow_headers=config.cors_allow_headers.split(","),
)

app.include_router(api_router)
