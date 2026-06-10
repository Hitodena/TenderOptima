import asyncio
from pathlib import Path
from typing import Literal

from loguru import logger
from pydantic import BaseModel, Field, ValidationError, field_validator

from backend.schemas.analysis import (
    TZAnalysisItem,
    TZAnalysisResult,
    TZAnalysisSessionResult,
    build_analysis_stats,
)
from backend.services.extraction.assembler import TextAssembler
from backend.services.extraction.router import ExtractorRouter
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.tz import (
    build_comparison_chunk_prompt,
    build_kp_chunk_prompt,
    build_tz_chunk_prompt,
)
from backend.utils.requirements_struct import (
    collect_leaf_entries,
    count_requirements,
    dedupe_hierarchy,
    flatten_hierarchy,
    merge_requirement_chunks,
    normalize_requirements_kp_flat,
    normalize_tz_requirements,
)
from backend.utils.text_chunker import chunk_text, clean_text

_router = ExtractorRouter()
_assembler = TextAssembler()

_ROLLING_SUMMARY_KEYS = 10
_LLM_CHUNK_MAX_ATTEMPTS = 3
_LLM_CHUNK_RETRY_DELAY_SEC = 2.0
_COMPARISON_CHUNK_SIZE = 15


class TZExtractResult(BaseModel):
    requirements: dict = Field(default_factory=dict)

    @field_validator("requirements", mode="before")
    @classmethod
    def coerce_requirements(cls, value: object) -> dict:
        return normalize_tz_requirements(value)


class KPExtractResult(BaseModel):
    offerings: dict = Field(default_factory=dict)

    @field_validator("offerings", mode="before")
    @classmethod
    def coerce_offerings(cls, value: object) -> dict:
        return normalize_tz_requirements(value)


def _build_rolling_summary(
    hierarchy: dict,
    *,
    max_keys: int = _ROLLING_SUMMARY_KEYS,
) -> str | None:
    entries = collect_leaf_entries(hierarchy)
    if not entries:
        return None
    keys = [key for key, _ in entries]
    recent = entries[-max_keys:]
    recent_keys = ", ".join(key for key, _ in recent)
    last_key = keys[-1]
    return (
        f"Уже извлечены требования из предыдущих фрагментов "
        f"({len(entries)} пунктов).\n"
        f"Последний номер пункта: {last_key}\n"
        f"Последние извлечённые номера (НЕ повторять): {recent_keys}\n"
        f"Извлекай только НОВЫЕ пункты из текущего фрагмента."
    )


def _looks_like_hierarchy(data: object) -> bool:
    if not isinstance(data, dict) or not data:
        return False
    for value in data.values():
        if not isinstance(value, dict):
            return False
        if not any(key in value for key in ("text", "children")):
            return False
    return True


def _coerce_llm_payload(raw: dict, result_key: str) -> dict:
    """Accept wrapped, bare hierarchy, and empty dicts from the LLM."""
    if not raw:
        return {result_key: {}}
    if result_key in raw:
        return raw
    if _looks_like_hierarchy(raw):
        return {result_key: raw}
    return raw


async def _llm_extract_chunk(
    chunk: str,
    rolling_context: str | None,
    chunk_idx: int,
    total_chunks: int,
    *,
    mode: Literal["tz", "kp"],
) -> dict:
    if mode == "tz":
        system, user = build_tz_chunk_prompt(
            chunk,
            rolling_context,
            chunk_idx,
            total_chunks,
        )
        result_key = "requirements"
        result_model = TZExtractResult
    else:
        system, user = build_kp_chunk_prompt(
            chunk,
            rolling_context,
            chunk_idx,
            total_chunks,
        )
        result_key = "offerings"
        result_model = KPExtractResult

    last_exc: Exception | None = None
    for attempt in range(1, _LLM_CHUNK_MAX_ATTEMPTS + 1):
        try:
            raw = await llm_client.complete(system, user)
            coerced = _coerce_llm_payload(raw, result_key)
            parsed = result_model(**coerced)
            partial = getattr(parsed, result_key)
            if not partial:
                logger.info(
                    "Requirements chunk empty",
                    mode=mode,
                    chunk=chunk_idx + 1,
                    total=total_chunks,
                )
            return partial
        except (ValidationError, ValueError, TypeError) as exc:
            last_exc = exc
            logger.warning(
                "Requirements chunk LLM attempt failed",
                mode=mode,
                chunk=chunk_idx + 1,
                total=total_chunks,
                attempt=attempt,
                max_attempts=_LLM_CHUNK_MAX_ATTEMPTS,
                error=str(exc),
            )
            if attempt >= _LLM_CHUNK_MAX_ATTEMPTS:
                break
            await asyncio.sleep(_LLM_CHUNK_RETRY_DELAY_SEC)

    assert last_exc is not None
    raise last_exc


async def _extract_hierarchical(
    text: str, *, mode: Literal["tz", "kp"]
) -> dict:
    cleaned = clean_text(text)
    chunks = chunk_text(cleaned)
    if not chunks:
        logger.warning(
            "Requirements extraction skipped", mode=mode, reason="empty_text"
        )
        return {}

    logger.info(
        "Requirements extraction started",
        mode=mode,
        text_chars=len(cleaned),
        chunks=len(chunks),
    )

    hierarchy: dict = {}
    rolling_ctx: str | None = None
    for index, chunk in enumerate(chunks):
        logger.info(
            "Requirements chunk processing",
            mode=mode,
            chunk=index + 1,
            total=len(chunks),
            chunk_chars=len(chunk),
        )
        partial = await _llm_extract_chunk(
            chunk,
            rolling_ctx,
            index,
            len(chunks),
            mode=mode,
        )
        hierarchy = merge_requirement_chunks([hierarchy, partial])
        rolling_ctx = _build_rolling_summary(hierarchy)
        logger.info(
            "Requirements chunk done",
            mode=mode,
            chunk=index + 1,
            total=len(chunks),
            items=count_requirements(hierarchy),
        )

    hierarchy = dedupe_hierarchy(hierarchy)
    logger.info(
        "Requirements extraction finished",
        mode=mode,
        items=count_requirements(hierarchy),
    )
    return hierarchy


async def extract_tz_requirements(tz_text: str) -> dict:
    return await _extract_hierarchical(tz_text, mode="tz")


async def extract_kp_requirements(kp_text: str) -> dict:
    return await _extract_hierarchical(kp_text, mode="kp")


def _chunk_list(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


async def _llm_compare_chunk(
    tz_chunk: list[str],
    kp_name: str,
    kp_offerings: list[str],
    *,
    chunk_idx: int,
    total_chunks: int,
) -> list[TZAnalysisItem]:
    system, user = build_comparison_chunk_prompt(
        tz_chunk,
        kp_name,
        kp_offerings,
        chunk_idx=chunk_idx,
        total_chunks=total_chunks,
    )
    last_exc: Exception | None = None
    for attempt in range(1, _LLM_CHUNK_MAX_ATTEMPTS + 1):
        try:
            raw = await llm_client.complete(system, user)
            result = TZAnalysisResult(**raw)
            return [
                item.model_copy(update={"kp_name": kp_name})
                for item in result.items
            ]
        except (ValidationError, ValueError, TypeError) as exc:
            last_exc = exc
            logger.warning(
                "Comparison chunk LLM attempt failed",
                kp_name=kp_name,
                chunk=chunk_idx + 1,
                total=total_chunks,
                attempt=attempt,
                max_attempts=_LLM_CHUNK_MAX_ATTEMPTS,
                error=str(exc),
            )
            if attempt >= _LLM_CHUNK_MAX_ATTEMPTS:
                break
            await asyncio.sleep(_LLM_CHUNK_RETRY_DELAY_SEC)

    assert last_exc is not None
    raise last_exc


async def _compare_single_kp(
    requirements_tz: list[str],
    kp_name: str,
    kp_offerings: list[str],
) -> list[TZAnalysisItem]:
    tz_chunks = _chunk_list(requirements_tz, _COMPARISON_CHUNK_SIZE)
    if not tz_chunks:
        return []

    logger.info(
        "TZ vs KP comparison started for supplier",
        kp_name=kp_name,
        tz_items=len(requirements_tz),
        kp_items=len(kp_offerings),
        chunks=len(tz_chunks),
    )

    all_items: list[TZAnalysisItem] = []
    for index, tz_chunk in enumerate(tz_chunks):
        logger.info(
            "Comparison chunk processing",
            kp_name=kp_name,
            chunk=index + 1,
            total=len(tz_chunks),
            chunk_items=len(tz_chunk),
        )
        items = await _llm_compare_chunk(
            tz_chunk,
            kp_name,
            kp_offerings,
            chunk_idx=index,
            total_chunks=len(tz_chunks),
        )
        all_items.extend(items)
        logger.info(
            "Comparison chunk done",
            kp_name=kp_name,
            chunk=index + 1,
            total=len(tz_chunks),
            items=len(items),
        )

    logger.info(
        "TZ vs KP comparison finished for supplier",
        kp_name=kp_name,
        items=len(all_items),
    )
    return all_items


async def compare_requirements(
    requirements_tz: list[str],
    requirements_kp: dict[str, list[str]],
) -> list[TZAnalysisItem]:
    if not requirements_kp:
        return []

    tasks = [
        _compare_single_kp(requirements_tz, kp_name, kp_offerings)
        for kp_name, kp_offerings in requirements_kp.items()
    ]
    results = await asyncio.gather(*tasks)
    all_items: list[TZAnalysisItem] = []
    for items in results:
        all_items.extend(items)
    return all_items


async def compare_only(
    requirements_tz: dict,
    requirements_kp: dict[str, dict],
) -> list[TZAnalysisItem]:
    tz_flat = flatten_hierarchy(normalize_tz_requirements(requirements_tz))
    kp_flat = normalize_requirements_kp_flat(requirements_kp)
    return await compare_requirements(tz_flat, kp_flat)


async def extract_tz_from_file(tz_path: Path) -> dict:
    """Extract TZ requirements from a file on disk."""
    logger.info("TZ file extraction started", path=str(tz_path))
    raw_text = _assembler.assemble(_router.get(tz_path).extract(tz_path))
    result = await extract_tz_requirements(raw_text)
    logger.info(
        "TZ file extraction finished",
        path=str(tz_path),
        items=count_requirements(result),
    )
    return result


async def analyze_kp_files(
    requirements_tz: dict,
    kp_paths: list[Path],
    *,
    kp_display_names: list[str] | None = None,
) -> TZAnalysisSessionResult:
    """Extract KP offerings and compare them against saved TZ requirements."""
    if not kp_paths:
        raise ValueError("At least one KP file is required")

    names = kp_display_names or [p.name for p in kp_paths]
    if len(names) != len(kp_paths):
        names = [p.name for p in kp_paths]

    tz_hierarchy = normalize_tz_requirements(requirements_tz)
    tz_flat = flatten_hierarchy(tz_hierarchy)
    tz_count = len(tz_flat)

    requirements_kp: dict[str, dict] = {}
    for kp_path, kp_name in zip(kp_paths, names, strict=True):
        logger.info(
            "KP file extraction started", kp_name=kp_name, path=str(kp_path)
        )
        raw_text = _assembler.assemble(_router.get(kp_path).extract(kp_path))
        requirements_kp[kp_name] = await extract_kp_requirements(raw_text)
        logger.info(
            "KP file extraction finished",
            kp_name=kp_name,
            items=count_requirements(requirements_kp[kp_name]),
        )

    logger.info("TZ vs KP comparison started", kp_count=len(names))
    kp_flat = normalize_requirements_kp_flat(requirements_kp)
    all_items = await compare_requirements(tz_flat, kp_flat)
    logger.info(
        "TZ vs KP comparison finished",
        kp_count=len(names),
        items=len(all_items),
    )
    kp_stats, primary_kp, top_stats = build_analysis_stats(all_items, names)

    return TZAnalysisSessionResult(
        kp_filename=primary_kp,
        kp_filenames=names,
        requirements_tz=tz_hierarchy,
        requirements_kp=requirements_kp,
        kp_stats=kp_stats,
        items=all_items,
        match_score=top_stats["match_score"],
        met_count=top_stats["met_count"],
        partial_count=top_stats["partial_count"],
        missing_count=top_stats["missing_count"],
        not_found_count=top_stats["not_found_count"],
        tz_requirements_count=tz_count,
    )
