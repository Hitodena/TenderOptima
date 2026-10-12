"""Model calls of one offer comparison: limited, cached and accounted for.

Every call goes through :class:`ModelCalls`, which

* runs at most ``kp_compare_concurrency`` calls at a time;
* keeps the parsed answer in Redis under a hash of the model and the prompt,
  so the same TZ and offer get the same verdicts on a re-run and do not pay
  twice (``llm_cache_ttl_seconds = 0`` switches this off);
* re-asks once when the answer does not fit the expected shape;
* counts calls, cache hits and tokens for the log.

A refused account (no key, no balance) stops the comparison at once:
continuing would only produce a result full of gaps.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
import zlib
from collections import Counter
from typing import TypeVar

from loguru import logger
from openai import APIStatusError
from pydantic import BaseModel, ValidationError
from redis.asyncio import Redis

from backend.core.config import get_config
from backend.services.llm.client import llm_client

config = get_config()

T = TypeVar("T", bound=BaseModel)

_CACHE_PREFIX = "kpcmp:v1:"
_FATAL_STATUSES = {401, 402, 403}
# answers with many points and quotes outgrow the provider's 4K default
_MAX_ANSWER_TOKENS = 8192
# the hidden reasoning counts towards the limit; give it room
_MAX_REASONING_ANSWER_TOKENS = 48_000


class ModelAccessError(RuntimeError):
    """The model API refused the account (key, balance or permissions)."""


class ModelCalls:
    """Model calls of one comparison run (create one per run)."""

    def __init__(
        self,
        *,
        analysis_id: str,
        user_id: str,
        kp_name: str,
        model: str | None = None,
        concurrency: int | None = None,
        cache_ttl: int | None = None,
    ) -> None:
        self.analysis_id = analysis_id
        self.user_id = user_id
        self.kp_name = kp_name
        self.model = model or config.openai_model_for_kp()
        self._semaphore = asyncio.Semaphore(
            max(1, concurrency or config.kp_compare_concurrency)
        )
        ttl = config.llm_cache_ttl_seconds if cache_ttl is None else cache_ttl
        self._cache_ttl = max(0, ttl)
        self._redis: Redis | None = None
        self._cache_broken = False
        self.stats: Counter[str] = Counter()

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception:  # pragma: no cover - closing is best effort
                pass
            self._redis = None

    def _cache(self) -> Redis | None:
        if self._cache_ttl <= 0 or self._cache_broken:
            return None
        if self._redis is None:
            self._redis = Redis(
                host=config.redis_host,
                port=config.redis_port,
                password=config.redis_password or None,
                db=config.llm_cache_redis_db,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
        return self._redis

    def _key(self, system: str, user: str) -> str:
        digest = hashlib.sha256()
        for part in (self.model, system, user):
            digest.update(part.encode("utf-8"))
            digest.update(b"\x00")
        return _CACHE_PREFIX + digest.hexdigest()

    async def _cache_get(self, key: str) -> dict | None:
        cache = self._cache()
        if cache is None:
            return None
        try:
            raw = await cache.get(key)
        except Exception as exc:
            self._disable_cache(exc)
            return None
        if raw is None:
            return None
        try:
            return json.loads(zlib.decompress(raw).decode("utf-8"))
        except (zlib.error, ValueError):
            return None

    async def _cache_set(self, key: str, value: dict) -> None:
        cache = self._cache()
        if cache is None:
            return
        payload = zlib.compress(
            json.dumps(value, ensure_ascii=False).encode("utf-8")
        )
        try:
            await cache.set(key, payload, ex=self._cache_ttl)
        except Exception as exc:
            self._disable_cache(exc)

    def _disable_cache(self, exc: Exception) -> None:
        if not self._cache_broken:
            logger.warning(
                "KP comparison cache unavailable, continuing without it",
                analysis_id=self.analysis_id,
                error=str(exc),
            )
        self._cache_broken = True

    async def json(
        self,
        stage: str,
        system: str,
        user: str,
        result_model: type[T],
        *,
        attempts: int = 2,
        thinking: bool = True,
    ) -> T:
        """Ask the model and parse the answer into *result_model*.

        ``thinking=False`` asks for an answer without the model's hidden
        reasoning: faster and cheaper, for mechanical steps.

        Raises :class:`ModelAccessError` when the account is refused and the
        last error when every attempt fails.
        """
        key = self._key(system, user + ("" if thinking else "\x00quick"))
        extra_body = None if thinking else {"thinking": {"type": "disabled"}}
        cached = await self._cache_get(key)
        if cached is not None:
            try:
                parsed = result_model.model_validate(cached)
            except ValidationError:
                parsed = None
            if parsed is not None:
                self.stats["cache_hits"] += 1
                self.stats[f"{stage}:cache_hits"] += 1
                return parsed

        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            started = time.monotonic()
            try:
                async with self._semaphore:
                    raw, usage = await llm_client.complete_with_usage(
                        system,
                        user,
                        model=self.model,
                        max_tokens=(
                            _MAX_REASONING_ANSWER_TOKENS
                            if thinking
                            else _MAX_ANSWER_TOKENS
                        ),
                        extra_body=extra_body,
                    )
            except APIStatusError as exc:
                if exc.status_code in _FATAL_STATUSES:
                    raise ModelAccessError(
                        f"model API refused the request ({exc.status_code})"
                    ) from exc
                last_error = exc
            except ValueError as exc:  # empty or non-JSON answer
                last_error = exc
            else:
                self._account(stage, usage, time.monotonic() - started)
                try:
                    parsed = result_model.model_validate(raw)
                except ValidationError as exc:
                    last_error = exc
                else:
                    await self._cache_set(key, raw)
                    return parsed
            logger.warning(
                "KP comparison model call failed",
                analysis_id=self.analysis_id,
                kp_name=self.kp_name,
                stage=stage,
                attempt=attempt,
                error=str(last_error)[:300],
            )
        assert last_error is not None
        raise last_error

    def _account(self, stage: str, usage: dict, seconds: float) -> None:
        self.stats["calls"] += 1
        self.stats[f"{stage}:calls"] += 1
        self.stats["model_seconds"] += round(seconds)
        for field in (
            "prompt_tokens",
            "completion_tokens",
            "prompt_cache_hit_tokens",
            "prompt_cache_miss_tokens",
        ):
            value = usage.get(field)
            if isinstance(value, int):
                self.stats[field] += value
        details = usage.get("completion_tokens_details") or {}
        reasoning = details.get("reasoning_tokens")
        if isinstance(reasoning, int):
            self.stats["reasoning_tokens"] += reasoning
