from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import api_router
from app.core.config import get_config
from app.core.logging_settings import LoggerSettings
from app.services.db_service import db_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = get_config()

    LoggerSettings(config).setup_logger()
    db_manager.init(config.build_db_url())

    yield

    await db_manager.close()


app = FastAPI(lifespan=lifespan)


app.include_router(api_router)
