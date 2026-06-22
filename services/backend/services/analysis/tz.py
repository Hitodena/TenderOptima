import asyncio
import re
from pathlib import Path
from typing import Literal

from loguru import logger
from pydantic import BaseModel, Field, ValidationError, field_validator

from backend.enums import TZAnalysisStatus
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
    build_heading_names_prompt,
    build_kp_chunk_prompt,
    build_kp_match_chunk_prompt,
    build_tz_chunk_prompt,
)
from backend.utils.requirements_struct import (
    collect_leaf_entries,
    count_requirements,
    dedupe_hierarchy,
    flatten_hierarchy,
    format_kp_offer_ref,
    format_tz_requirement_ref,
    key_from_reference,
    merge_requirement_chunks,
    normalize_tz_requirements,
    requirement_key_from_flat,
    strip_page_from_ref,
)
from backend.utils.text_chunker import chunk_text, clean_text

_router = ExtractorRouter()
_assembler = TextAssembler()

_ROLLING_SUMMARY_KEYS = 10
_LLM_CHUNK_MAX_ATTEMPTS = 3
_LLM_CHUNK_RETRY_DELAY_SEC = 2.0
_NUMBERED_REQ_LINE_RE = re.compile(r"^\d+\.\s+(.*)$")
_STATUS_RANK = {
    TZAnalysisStatus.NOT_FOUND: 0,
    TZAnalysisStatus.MISSING: 1,
    TZAnalysisStatus.PARTIAL: 2,
    TZAnalysisStatus.MET: 3,
}


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


class HeadingNamesResult(BaseModel):
    headings: dict[str, str] = Field(default_factory=dict)


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
    analysis_id: str,
    user_id: str,
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
                    analysis_id=analysis_id,
                    user_id=user_id,
                    mode=mode,
                    chunk=chunk_idx + 1,
                    total=total_chunks,
                )
            return partial
        except (ValidationError, ValueError, TypeError) as exc:
            last_exc = exc
            logger.warning(
                "Requirements chunk LLM attempt failed",
                analysis_id=analysis_id,
                user_id=user_id,
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
    text: str,
    *,
    mode: Literal["tz", "kp"],
    analysis_id: str,
    user_id: str,
) -> dict:
    cleaned = clean_text(text)
    chunks = chunk_text(cleaned)
    if not chunks:
        logger.warning(
            "Requirements extraction skipped",
            analysis_id=analysis_id,
            user_id=user_id,
            mode=mode,
            reason="empty_text",
        )
        return {}

    logger.info(
        "Requirements extraction started",
        analysis_id=analysis_id,
        user_id=user_id,
        mode=mode,
        text_chars=len(cleaned),
        chunks=len(chunks),
    )

    hierarchy: dict = {}
    rolling_ctx: str | None = None
    for index, chunk in enumerate(chunks):
        logger.info(
            "Requirements chunk processing",
            analysis_id=analysis_id,
            user_id=user_id,
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
            analysis_id=analysis_id,
            user_id=user_id,
        )
        hierarchy = merge_requirement_chunks([hierarchy, partial])
        rolling_ctx = _build_rolling_summary(hierarchy)
        logger.info(
            "Requirements chunk done",
            analysis_id=analysis_id,
            user_id=user_id,
            mode=mode,
            chunk=index + 1,
            total=len(chunks),
            items=count_requirements(hierarchy),
        )

    hierarchy = dedupe_hierarchy(hierarchy)
    hierarchy = normalize_tz_requirements(hierarchy)
    if mode == "tz":
        hierarchy = await fill_empty_headings(
            hierarchy,
            analysis_id=analysis_id,
            user_id=user_id,
        )
    logger.info(
        "Requirements extraction finished",
        analysis_id=analysis_id,
        user_id=user_id,
        mode=mode,
        items=count_requirements(hierarchy),
    )
    return hierarchy


def _heading_node_key(key: object) -> str:
    """Return canonical dotted key as stored in normalized hierarchy."""
    return str(key).replace("/", ".")


def _collect_empty_headings(
    hierarchy: dict,
) -> list[tuple[str, list[str]]]:
    """Return heading keys with empty text and sample child texts."""
    result: list[tuple[str, list[str]]] = []

    def walk(nodes: dict) -> None:
        for key in sorted(nodes.keys(), key=lambda item: str(item)):
            node = nodes[key]
            key_str = _heading_node_key(key)
            text = str(node.get("text") or "").strip()
            children = node.get("children") or {}
            if not text and children:
                child_texts = [
                    entry[1] for entry in collect_leaf_entries(children)
                ][:5]
                result.append((key_str, child_texts))
            if children:
                walk(children)

    walk(hierarchy)
    return result


def _fallback_heading_name(key: str, child_texts: list[str]) -> str:
    if child_texts:
        sample = child_texts[0].strip()
        if len(sample) > 80:
            return f"{sample[:77].rstrip()}..."
        return sample
    return f"Раздел {key}"


def _apply_heading_names(hierarchy: dict, names: dict[str, str]) -> dict:
    if not names:
        return hierarchy

    def walk(nodes: dict) -> None:
        for key, node in list(nodes.items()):
            key_str = _heading_node_key(key)
            text = str(node.get("text") or "").strip()
            children = node.get("children") or {}
            if not text and key_str in names:
                node["text"] = names[key_str].strip()
            if children:
                walk(children)

    walk(hierarchy)
    return hierarchy


async def fill_empty_headings(
    hierarchy: dict,
    *,
    analysis_id: str,
    user_id: str,
) -> dict:
    """Generate meaningful names for heading nodes with empty text."""
    empty = _collect_empty_headings(hierarchy)
    if not empty:
        return hierarchy

    logger.info(
        "Empty headings detected",
        analysis_id=analysis_id,
        user_id=user_id,
        count=len(empty),
    )

    names: dict[str, str] = {}
    system, user = build_heading_names_prompt(empty)
    try:
        raw = await llm_client.complete(system, user)
        parsed = HeadingNamesResult(**raw)
        names = {
            _heading_node_key(key): str(value).strip()
            for key, value in parsed.headings.items()
            if str(value).strip()
        }
    except (ValidationError, ValueError, TypeError) as exc:
        logger.warning(
            "Empty heading fill failed",
            analysis_id=analysis_id,
            user_id=user_id,
            error=str(exc),
        )

    if not names:
        names = {
            key: _fallback_heading_name(key, child_texts)
            for key, child_texts in empty
        }
        logger.info(
            "Empty headings filled from child samples",
            analysis_id=analysis_id,
            user_id=user_id,
            count=len(names),
        )
    else:
        hierarchy = _apply_heading_names(hierarchy, names)
        logger.info(
            "Empty headings filled",
            analysis_id=analysis_id,
            user_id=user_id,
            count=len(names),
        )
        return hierarchy

    hierarchy = _apply_heading_names(hierarchy, names)
    return hierarchy


async def extract_tz_requirements(
    tz_text: str,
    *,
    analysis_id: str,
    user_id: str,
) -> dict:
    return await _extract_hierarchical(
        tz_text,
        mode="tz",
        analysis_id=analysis_id,
        user_id=user_id,
    )


async def extract_kp_requirements(
    kp_text: str,
    *,
    analysis_id: str,
    user_id: str,
) -> dict:
    return await _extract_hierarchical(
        kp_text,
        mode="kp",
        analysis_id=analysis_id,
        user_id=user_id,
    )


def _parse_numbered_requirement_batch(batch_text: str) -> list[str]:
    """Restore requirement strings from a numbered batch produced by chunk_text."""
    requirements: list[str] = []
    for line in batch_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        match = _NUMBERED_REQ_LINE_RE.match(stripped)
        if match:
            requirements.append(match.group(1).strip())
            continue
        if requirements:
            requirements[-1] = f"{requirements[-1]} {stripped}"
    return requirements


def _batch_tz_requirements(tz_flat: list[str]) -> list[list[str]]:
    """Split TZ requirements into LLM-sized batches using chunk_text (8000 chars)."""
    if not tz_flat:
        return []
    numbered = "\n".join(
        f"{index + 1}. {req}" for index, req in enumerate(tz_flat)
    )
    batches: list[list[str]] = []
    for batch in chunk_text(numbered):
        parsed = _parse_numbered_requirement_batch(batch)
        if parsed:
            batches.append(parsed)
    return batches


def _status_rank(status: TZAnalysisStatus) -> int:
    return _STATUS_RANK.get(status, 0)


def _should_keep_searching(item: TZAnalysisItem | None) -> bool:
    if item is None:
        return True
    return item.status != TZAnalysisStatus.MET


def _merge_match_item(
    found: dict[str, TZAnalysisItem],
    item: TZAnalysisItem,
    *,
    kp_name: str,
) -> None:
    req_key = requirement_key_from_flat(item.requirement)
    if not req_key:
        return
    normalized = item.model_copy(update={"kp_name": kp_name})
    existing = found.get(req_key)
    if existing is None or _status_rank(normalized.status) > _status_rank(
        existing.status
    ):
        found[req_key] = normalized


def _ensure_item_refs(items: list[TZAnalysisItem]) -> list[TZAnalysisItem]:
    """Fill missing refs and strip page numbers from LLM output."""
    updated: list[TZAnalysisItem] = []
    for item in items:
        req_key = requirement_key_from_flat(item.requirement)
        requirement_ref = strip_page_from_ref(item.requirement_ref)
        if not requirement_ref and req_key:
            requirement_ref = format_tz_requirement_ref(
                req_key,
                None,
                item.requirement,
            )

        offer_ref = strip_page_from_ref(item.offer_ref)
        if item.offer_value and item.offer_value.strip() and not offer_ref:
            offer_key = key_from_reference(offer_ref) or req_key
            offer_ref = format_kp_offer_ref(
                offer_key,
                None,
                item.offer_value,
            )

        updated.append(
            item.model_copy(
                update={
                    "requirement_ref": requirement_ref,
                    "offer_ref": offer_ref,
                },
            ),
        )
    return updated


async def _llm_match_kp_chunk(
    tz_batch: list[str],
    kp_chunk: str,
    kp_name: str,
    *,
    already_found: list[str],
    kp_chunk_idx: int,
    total_kp_chunks: int,
    tz_batch_idx: int,
    total_tz_batches: int,
    analysis_id: str,
    user_id: str,
) -> list[TZAnalysisItem]:
    system, user = build_kp_match_chunk_prompt(
        tz_batch,
        kp_chunk,
        kp_name,
        already_found=already_found,
        kp_chunk_idx=kp_chunk_idx,
        total_kp_chunks=total_kp_chunks,
        tz_batch_idx=tz_batch_idx,
        total_tz_batches=total_tz_batches,
    )
    last_exc: Exception | None = None
    for attempt in range(1, _LLM_CHUNK_MAX_ATTEMPTS + 1):
        try:
            raw = await llm_client.complete(system, user)
            result = TZAnalysisResult(**raw)
            items = [
                item.model_copy(update={"kp_name": kp_name})
                for item in result.items
                if item.status != TZAnalysisStatus.NOT_FOUND
            ]
            return _ensure_item_refs(items)
        except (ValidationError, ValueError, TypeError) as exc:
            last_exc = exc
            logger.warning(
                "KP match chunk LLM attempt failed",
                analysis_id=analysis_id,
                user_id=user_id,
                kp_name=kp_name,
                kp_chunk=kp_chunk_idx + 1,
                tz_batch=tz_batch_idx + 1,
                attempt=attempt,
                max_attempts=_LLM_CHUNK_MAX_ATTEMPTS,
                error=str(exc),
            )
            if attempt >= _LLM_CHUNK_MAX_ATTEMPTS:
                break
            await asyncio.sleep(_LLM_CHUNK_RETRY_DELAY_SEC)

    assert last_exc is not None
    raise last_exc


def _build_not_found_items(
    tz_flat: list[str],
    found: dict[str, TZAnalysisItem],
    *,
    kp_name: str,
) -> list[TZAnalysisItem]:
    """Append not_found rows for TZ requirements missing from *found*."""
    items: list[TZAnalysisItem] = []
    for requirement in tz_flat:
        req_key = requirement_key_from_flat(requirement)
        if req_key and req_key in found:
            items.append(found[req_key])
            continue
        items.append(
            TZAnalysisItem(
                requirement=requirement,
                requirement_ref=format_tz_requirement_ref(
                    req_key,
                    None,
                    requirement,
                ),
                offer_value=None,
                offer_ref=None,
                explanation="В КП не найдена информация по требованию.",
                status=TZAnalysisStatus.NOT_FOUND,
                kp_name=kp_name,
            ),
        )
    return _ensure_item_refs(items)


def _matches_to_kp_hierarchy(items: list[TZAnalysisItem]) -> dict:
    """Build diagnostic KP hierarchy from direct match results."""
    partial: dict = {}
    for item in items:
        if not item.offer_value or not str(item.offer_value).strip():
            continue
        req_key = requirement_key_from_flat(item.requirement)
        offer_key = key_from_reference(item.offer_ref) or req_key
        if not offer_key:
            continue
        partial[offer_key] = {
            "text": str(item.offer_value).strip(),
            "children": {},
        }
    return normalize_tz_requirements(partial)


async def _match_kp_text_against_tz(
    kp_text: str,
    tz_flat: list[str],
    kp_name: str,
    *,
    analysis_id: str,
    user_id: str,
    found: dict[str, TZAnalysisItem] | None = None,
) -> dict[str, TZAnalysisItem]:
    """Search KP text chunks for TZ requirement matches."""
    cleaned = clean_text(kp_text)
    kp_chunks = chunk_text(cleaned)
    if not kp_chunks:
        logger.warning(
            "KP match skipped",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            reason="empty_text",
        )
        return found or {}

    tz_batches = _batch_tz_requirements(tz_flat)
    if not tz_batches:
        return found or {}

    matches = dict(found or {})
    total_kp_chunks = len(kp_chunks)
    total_tz_batches = len(tz_batches)

    logger.info(
        "KP direct match started",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        tz_items=len(tz_flat),
        kp_chunks=total_kp_chunks,
        tz_batches=total_tz_batches,
    )

    for kp_idx, kp_chunk in enumerate(kp_chunks):
        already_found = [
            item.requirement
            for key, item in sorted(matches.items())
            if not _should_keep_searching(item)
        ]

        logger.info(
            "KP match chunk processing",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            kp_chunk=kp_idx + 1,
            total_kp_chunks=total_kp_chunks,
            chunk_chars=len(kp_chunk),
        )

        for tz_idx, tz_batch in enumerate(tz_batches):
            pending = [
                req
                for req in tz_batch
                if _should_keep_searching(
                    matches.get(requirement_key_from_flat(req) or "")
                )
            ]
            if not pending:
                continue

            items = await _llm_match_kp_chunk(
                pending,
                kp_chunk,
                kp_name,
                already_found=already_found,
                kp_chunk_idx=kp_idx,
                total_kp_chunks=total_kp_chunks,
                tz_batch_idx=tz_idx,
                total_tz_batches=total_tz_batches,
                analysis_id=analysis_id,
                user_id=user_id,
            )
            for item in items:
                _merge_match_item(matches, item, kp_name=kp_name)

        logger.info(
            "KP match chunk done",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            kp_chunk=kp_idx + 1,
            total_kp_chunks=total_kp_chunks,
            matched=len(matches),
        )

    logger.info(
        "KP direct match finished",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        matched=len(matches),
        tz_items=len(tz_flat),
    )
    return matches


async def _match_kp_paths_against_tz(
    kp_paths: list[Path],
    tz_flat: list[str],
    kp_name: str,
    *,
    analysis_id: str,
    user_id: str,
) -> tuple[list[TZAnalysisItem], dict]:
    """Match one or more KP files against TZ and return items + hierarchy."""
    found: dict[str, TZAnalysisItem] = {}
    for kp_path in kp_paths:
        logger.info(
            "KP file match started",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            path=str(kp_path),
        )
        raw_text = _assembler.assemble(_router.get(kp_path).extract(kp_path))
        found = await _match_kp_text_against_tz(
            raw_text,
            tz_flat,
            kp_name,
            analysis_id=analysis_id,
            user_id=user_id,
            found=found,
        )
        logger.info(
            "KP file match finished",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            path=str(kp_path),
            matched=len(found),
        )

    items = _build_not_found_items(tz_flat, found, kp_name=kp_name)
    return items, _matches_to_kp_hierarchy(items)


async def extract_tz_from_file(
    tz_path: Path,
    *,
    analysis_id: str,
    user_id: str,
) -> dict:
    """Extract TZ requirements from a file on disk."""
    logger.info(
        "TZ file extraction started",
        analysis_id=analysis_id,
        user_id=user_id,
        path=str(tz_path),
    )
    raw_text = _assembler.assemble(_router.get(tz_path).extract(tz_path))
    result = await extract_tz_requirements(
        raw_text,
        analysis_id=analysis_id,
        user_id=user_id,
    )
    logger.info(
        "TZ file extraction finished",
        analysis_id=analysis_id,
        user_id=user_id,
        path=str(tz_path),
        items=count_requirements(result),
    )
    return result


async def analyze_kp_files(
    requirements_tz: dict,
    kp_paths: list[Path],
    *,
    kp_display_names: list[str] | None = None,
    analysis_id: str,
    user_id: str,
) -> TZAnalysisSessionResult:
    """Match KP files directly against saved TZ requirements."""
    if not kp_paths:
        raise ValueError("At least one KP file is required")

    names = kp_display_names or [p.name for p in kp_paths]
    if len(names) != len(kp_paths):
        names = [p.name for p in kp_paths]

    tz_hierarchy = normalize_tz_requirements(requirements_tz)
    tz_flat = flatten_hierarchy(tz_hierarchy)
    tz_count = len(tz_flat)

    requirements_kp: dict[str, dict] = {}
    all_items: list[TZAnalysisItem] = []
    for kp_path, kp_name in zip(kp_paths, names, strict=True):
        items, hierarchy = await _match_kp_paths_against_tz(
            [kp_path],
            tz_flat,
            kp_name,
            analysis_id=analysis_id,
            user_id=user_id,
        )
        requirements_kp[kp_name] = hierarchy
        all_items.extend(items)
        logger.info(
            "KP analysis finished",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            items=len(items),
            matched=count_requirements(hierarchy),
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


async def analyze_supplier_kps(
    requirements_tz: dict,
    kp_files: list[tuple[str, list[Path]]],
    *,
    analysis_id: str,
    user_id: str,
) -> TZAnalysisSessionResult:
    """Match supplier KP files directly against TZ requirements."""
    if not kp_files:
        raise ValueError("At least one KP file is required")

    tz_hierarchy = normalize_tz_requirements(requirements_tz)
    tz_flat = flatten_hierarchy(tz_hierarchy)
    tz_count = len(tz_flat)
    kp_display_names = [name for name, _ in kp_files]

    requirements_kp: dict[str, dict] = {}
    all_items: list[TZAnalysisItem] = []
    for display_name, kp_paths in kp_files:
        if not kp_paths:
            raise ValueError(f"KP file {display_name!r} has no paths")
        items, hierarchy = await _match_kp_paths_against_tz(
            kp_paths,
            tz_flat,
            display_name,
            analysis_id=analysis_id,
            user_id=user_id,
        )
        requirements_kp[display_name] = hierarchy
        all_items.extend(items)
        logger.info(
            "Supplier KP analysis finished",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=display_name,
            files=len(kp_paths),
            items=len(items),
            matched=count_requirements(hierarchy),
        )

    kp_stats, primary_kp, top_stats = build_analysis_stats(
        all_items,
        kp_display_names,
    )

    return TZAnalysisSessionResult(
        kp_filename=primary_kp,
        kp_filenames=kp_display_names,
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
