import asyncio
import functools


def async_task(func):
    """Wraps an async coroutine so Celery prefork workers can execute it."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return asyncio.run(func(*args, **kwargs))

    return wrapper
