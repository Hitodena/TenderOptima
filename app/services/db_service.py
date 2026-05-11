import contextlib
import time
from collections.abc import AsyncIterator

from loguru import logger
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


class DatabaseSessionManager:
    def __init__(self, url: str) -> None:
        """Initialize the DatabaseSessionManager.

        Args:
            url (str): The database connection URL.
        """
        self._engine: AsyncEngine | None = None
        self._sessionmaker: async_sessionmaker[AsyncSession] | None = None
        self.url = url

    def init(self) -> None:
        """Initialize the database engine and sessionmaker.

        This method sets up the asynchronous database engine and sessionmaker
        using the provided URL.
        """
        logger.info("Connecting to DB", url=self.url)
        self._engine = create_async_engine(
            url=self.url,
            pool_pre_ping=True,
        )
        self._sessionmaker = async_sessionmaker(
            bind=self._engine,
            expire_on_commit=False,
            autoflush=False,
        )
        logger.info("Successfully connected to DB", url=self.url)

    async def close(self) -> None:
        """Close the database connection.

        This method disposes of the database engine and resets the state.

        Raises:
            RuntimeError: If the database engine is not started.
        """
        logger.info("Closing DB connection", url=self.url)
        if self._engine is None:
            logger.error("DB engine is not started", url=self.url)
            raise RuntimeError("DB engine is not started. Start by .init()")
        await self._engine.dispose()
        self._engine = None
        self._sessionmaker = None
        logger.info("DB connection was successfully closed", url=self.url)

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """Provide an asynchronous database session.

        This context manager yields an AsyncSession for database operations.
        It handles logging, rollback on exceptions, and session cleanup.

        Yields:
            AsyncSession: The database session.

        Raises:
            RuntimeError: If the DatabaseSessionManager is not initialized.
        """
        if self._sessionmaker is None:
            logger.critical("DatabaseSessionManager is not initialized")
            raise RuntimeError("DatabaseSessionManager is not initialized")
        async with self._sessionmaker() as session:
            try:
                start_time = time.perf_counter()
                logger.info("Yielding session")
                yield session
                elapsed_time = time.perf_counter() - start_time
                logger.info(
                    "Session yielded successfully",
                    execution_time=f"{elapsed_time:.2f}",
                )
            except Exception as exc:
                logger.exception("Failed to yield session", error=exc)
                await session.rollback()
                raise
            finally:
                await session.close()
