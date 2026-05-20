from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
