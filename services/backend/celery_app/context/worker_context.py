import time

from loguru import logger

from backend.core import get_config
from backend.core.logging_settings import LoggerSettings
from backend.services.db_service import DatabaseSessionManager


class WorkerContext:
    _instance: "WorkerContext | None" = None

    def __init__(self) -> None:
        self.db_manager: DatabaseSessionManager | None = None
        self.config = get_config()

    @classmethod
    async def init(cls) -> "WorkerContext":
        if cls._instance is None:
            cls._instance = cls()
            await cls._instance._setup()
        return cls._instance

    async def _setup(self) -> None:
        LoggerSettings(self.config).setup_logger()

        start_time = time.perf_counter()
        logger.info("Initializing worker context")
        try:
            self.db_manager = DatabaseSessionManager()
            self.db_manager.init(self.config.build_db_url())
            elapsed_time = time.perf_counter() - start_time
            logger.info(
                "Worker context initialized",
                execution_time=f"{elapsed_time:.2f}",
            )

        except Exception as exc:
            await self.cleanup()
            logger.exception(
                "Failed to initislize worker context", error=str(exc)
            )
            raise

    async def cleanup(self) -> None:
        try:
            logger.info("Cleaning worker context")
            if self.db_manager:
                await self.db_manager.close()
            logger.info("Worker context cleaned")

        except Exception as exc:
            await self.cleanup()
            logger.exception("Failed to clean worker context", error=str(exc))
            raise
