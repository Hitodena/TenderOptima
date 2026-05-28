import asyncio
import functools

from backend.celery_app.context import WorkerContext


def get_db_manager():
    ctx = WorkerContext._instance
    if ctx is None or ctx.db_manager is None:
        raise RuntimeError("WorkerContext is not initialized")
    return ctx.db_manager


def async_task(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(func(*args, **kwargs))

    return wrapper
