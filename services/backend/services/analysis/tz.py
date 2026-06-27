import asyncio
from pathlib import Path

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
    build_kp_match_chunk_prompt,
    build_kp_normalize_prompt,
    build_recall_sweep_prompt,
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
    resolve_letter_tz_fields,
    strip_page_from_ref,
)
from backend.utils.text_chunker import chunk_text, clean_text

_router = ExtractorRouter()
_assembler = TextAssembler()

_ROLLING_SUMMARY_KEYS = 10
_ROLLING_DIGEST_SECTIONS = 8
_LLM_CHUNK_MAX_ATTEMPTS = 3
_LLM_CHUNK_RETRY_DELAY_SEC = 2.0
_RECALL_BATCH_SIZE = 20
_RECALL_MIN_NOT_FOUND_RATIO = 0.4
_CHUNK_MATCH_BATCH_SIZE = 25
_COMPLIANCE_CONCURRENCY = 4
_RECALL_KP_MAX_CHARS = 16000
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


class HeadingNamesResult(BaseModel):
    headings: dict[str, str] = Field(default_factory=dict)


class KPDigestFact(BaseModel):
    ru_text: str
    src_quote: str = ""


class KPDigestSection(BaseModel):
    title: str = ""
    summary: str = ""
    facts: list[KPDigestFact] = Field(default_factory=list)


class KPNormalizeResult(BaseModel):
    sections: dict[str, KPDigestSection] = Field(default_factory=dict)


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


async def _llm_extract_tz_chunk(
    chunk: str,
    rolling_context: str | None,
    chunk_idx: int,
    total_chunks: int,
    *,
    analysis_id: str,
    user_id: str,
) -> dict:
    system, user = build_tz_chunk_prompt(
        chunk,
        rolling_context,
        chunk_idx,
        total_chunks,
    )
    result_key = "requirements"
    result_model = TZExtractResult

    last_exc: Exception | None = None
    for attempt in range(1, _LLM_CHUNK_MAX_ATTEMPTS + 1):
        try:
            raw = await llm_client.complete(system, user)
            coerced = _coerce_llm_payload(raw, result_key)
            parsed = result_model(**coerced)
            partial = parsed.requirements
            if not partial:
                logger.info(
                    "Requirements chunk empty",
                    analysis_id=analysis_id,
                    user_id=user_id,
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


async def _extract_tz_hierarchical(
    text: str,
    *,
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
            reason="empty_text",
        )
        return {}

    logger.info(
        "Requirements extraction started",
        analysis_id=analysis_id,
        user_id=user_id,
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
            chunk=index + 1,
            total=len(chunks),
            chunk_chars=len(chunk),
        )
        partial = await _llm_extract_tz_chunk(
            chunk,
            rolling_ctx,
            index,
            len(chunks),
            analysis_id=analysis_id,
            user_id=user_id,
        )
        hierarchy = merge_requirement_chunks([hierarchy, partial])
        rolling_ctx = _build_rolling_summary(hierarchy)
        logger.info(
            "Requirements chunk done",
            analysis_id=analysis_id,
            user_id=user_id,
            chunk=index + 1,
            total=len(chunks),
            items=count_requirements(hierarchy),
        )

    hierarchy = dedupe_hierarchy(hierarchy)
    hierarchy = normalize_tz_requirements(hierarchy)
    hierarchy = await fill_empty_headings(
        hierarchy,
        analysis_id=analysis_id,
        user_id=user_id,
    )
    logger.info(
        "Requirements extraction finished",
        analysis_id=analysis_id,
        user_id=user_id,
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
    return await _extract_tz_hierarchical(
        tz_text,
        analysis_id=analysis_id,
        user_id=user_id,
    )


def _batch_requirements(
    requirements: list[str],
    batch_size: int,
) -> list[list[str]]:
    """Split requirements into fixed-size batches."""
    if not requirements:
        return []
    return [
        requirements[index : index + batch_size]
        for index in range(0, len(requirements), batch_size)
    ]


def _normalize_fact_key(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _merge_kp_digests(parts: list[dict]) -> dict:
    """Merge partial KP digests from chunked normalization."""
    merged: dict[str, dict] = {}
    seen_facts: dict[str, set[str]] = {}

    for part in parts:
        if not part:
            continue
        for key, section in part.items():
            key_str = str(key)
            if key_str not in merged:
                merged[key_str] = {
                    "title": "",
                    "summary": "",
                    "facts": [],
                }
                seen_facts[key_str] = set()

            title = str(section.get("title") or "").strip()
            summary = str(section.get("summary") or "").strip()
            if title and not merged[key_str]["title"]:
                merged[key_str]["title"] = title
            if summary and not merged[key_str]["summary"]:
                merged[key_str]["summary"] = summary
            elif summary and summary not in merged[key_str]["summary"]:
                merged[key_str]["summary"] = (
                    f"{merged[key_str]['summary']}; {summary}"
                ).strip("; ")

            for fact in section.get("facts") or []:
                if not isinstance(fact, dict):
                    continue
                ru_text = str(fact.get("ru_text") or "").strip()
                if not ru_text:
                    continue
                norm = _normalize_fact_key(ru_text)
                if norm in seen_facts[key_str]:
                    continue
                seen_facts[key_str].add(norm)
                merged[key_str]["facts"].append(
                    {
                        "ru_text": ru_text,
                        "src_quote": str(fact.get("src_quote") or "").strip(),
                    },
                )

    return merged


def _build_digest_rolling_context(
    digest: dict,
    *,
    max_sections: int = _ROLLING_DIGEST_SECTIONS,
) -> str | None:
    if not digest:
        return None
    keys = sorted(digest.keys())
    recent = keys[-max_sections:]
    lines = []
    for key in recent:
        section = digest[key]
        title = str(section.get("title") or key)
        fact_count = len(section.get("facts") or [])
        lines.append(f"- {key}: {title} ({fact_count} фактов)")
    return (
        f"Уже извлечены разделы КП из предыдущих фрагментов "
        f"({len(digest)} разделов, {sum(len(v.get('facts') or []) for v in digest.values())} фактов).\n"
        f"Последние разделы (НЕ повторять факты):\n"
        + "\n".join(lines)
        + "\nИзвлекай только НОВЫЕ факты из текущего фрагмента."
    )


def _digest_to_hierarchy(digest: dict) -> dict:
    """Convert KP digest to RequirementsHierarchy for storage/display."""
    hierarchy: dict = {}
    for index, key in enumerate(sorted(digest.keys()), start=1):
        section = digest[key]
        title = str(section.get("title") or key).strip()
        summary = str(section.get("summary") or "").strip()
        parent_text = title
        if summary and summary != title:
            parent_text = f"{title}: {summary}" if title else summary

        children: dict = {}
        for fact_index, fact in enumerate(section.get("facts") or [], start=1):
            if not isinstance(fact, dict):
                continue
            ru_text = str(fact.get("ru_text") or "").strip()
            if not ru_text:
                continue
            child_key = f"{index}.{fact_index}"
            children[child_key] = {"text": ru_text, "children": {}}

        hierarchy[str(index)] = {"text": parent_text, "children": children}

    return normalize_tz_requirements(hierarchy)


async def _llm_call_with_retry(
    system: str,
    user: str,
    result_model: type[BaseModel],
    *,
    analysis_id: str,
    user_id: str,
    stage: str,
    context: dict | None = None,
) -> BaseModel:
    last_exc: Exception | None = None
    log_ctx = context or {}
    for attempt in range(1, _LLM_CHUNK_MAX_ATTEMPTS + 1):
        try:
            raw = await llm_client.complete(system, user)
            return result_model(**raw)
        except (ValidationError, ValueError, TypeError) as exc:
            last_exc = exc
            logger.warning(
                "Staged analysis LLM attempt failed",
                analysis_id=analysis_id,
                user_id=user_id,
                stage=stage,
                attempt=attempt,
                max_attempts=_LLM_CHUNK_MAX_ATTEMPTS,
                error=str(exc),
                **log_ctx,
            )
            if attempt >= _LLM_CHUNK_MAX_ATTEMPTS:
                break
            await asyncio.sleep(_LLM_CHUNK_RETRY_DELAY_SEC)

    assert last_exc is not None
    raise last_exc


async def _llm_normalize_kp_chunk(
    chunk: str,
    rolling_context: str | None,
    chunk_idx: int,
    total_chunks: int,
    *,
    analysis_id: str,
    user_id: str,
) -> dict:
    system, user = build_kp_normalize_prompt(
        chunk,
        chunk_idx=chunk_idx,
        total_chunks=total_chunks,
        rolling_context=rolling_context,
    )
    parsed = await _llm_call_with_retry(
        system,
        user,
        KPNormalizeResult,
        analysis_id=analysis_id,
        user_id=user_id,
        stage="kp_normalize",
        context={"chunk": chunk_idx + 1, "total": total_chunks},
    )
    return {
        key: section.model_dump() for key, section in parsed.sections.items()
    }


async def _normalize_kp_to_digest(
    kp_text: str,
    *,
    analysis_id: str,
    user_id: str,
    kp_name: str,
) -> dict:
    """Stage 1: extract KP offerings as Russian structured digest."""
    cleaned = clean_text(kp_text)
    chunks = chunk_text(cleaned)
    if not chunks:
        logger.warning(
            "KP normalization skipped",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            reason="empty_text",
        )
        return {}

    logger.info(
        "KP normalization started",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        text_chars=len(cleaned),
        chunks=len(chunks),
    )

    partials: list[dict] = []
    rolling_ctx: str | None = None
    running_digest: dict = {}

    for index, chunk in enumerate(chunks):
        logger.info(
            "KP normalize chunk processing",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            chunk=index + 1,
            total=len(chunks),
            chunk_chars=len(chunk),
        )
        partial = await _llm_normalize_kp_chunk(
            chunk,
            rolling_ctx,
            index,
            len(chunks),
            analysis_id=analysis_id,
            user_id=user_id,
        )
        partials.append(partial)
        running_digest = _merge_kp_digests([running_digest, partial])
        rolling_ctx = _build_digest_rolling_context(running_digest)
        logger.info(
            "KP normalize chunk done",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            chunk=index + 1,
            total=len(chunks),
            sections=len(running_digest),
            facts=sum(
                len(section.get("facts") or [])
                for section in running_digest.values()
            ),
        )

    digest = _merge_kp_digests(partials)
    logger.info(
        "KP normalization finished",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        sections=len(digest),
        facts=sum(
            len(section.get("facts") or []) for section in digest.values()
        ),
    )
    return digest


async def _llm_recall_batch(
    tz_batch: list[str],
    kp_text: str,
    *,
    batch_idx: int,
    total_batches: int,
    analysis_id: str,
    user_id: str,
    kp_name: str,
    tz_hierarchy: dict | None = None,
) -> list[TZAnalysisItem]:
    """Recall sweep for still-unmatched requirements."""
    system, user = build_recall_sweep_prompt(
        tz_batch,
        kp_text,
        batch_idx=batch_idx,
        total_batches=total_batches,
    )
    parsed = await _llm_call_with_retry(
        system,
        user,
        TZAnalysisResult,
        analysis_id=analysis_id,
        user_id=user_id,
        stage="recall_sweep",
        context={"kp_name": kp_name, "batch": batch_idx + 1},
    )
    by_requirement = {
        requirement_key_from_flat(item.requirement)
        or item.requirement.strip(): item.model_copy(
            update={"kp_name": kp_name},
        )
        for item in parsed.items
    }
    items: list[TZAnalysisItem] = []
    for req in tz_batch:
        req_key = requirement_key_from_flat(req) or req.strip()
        item = by_requirement.get(req_key) or by_requirement.get(req.strip())
        if item is None:
            continue
        if item.requirement.strip() != req.strip():
            item = item.model_copy(update={"requirement": req})
        items.append(item)
    return _ensure_item_refs(items, tz_hierarchy)


def _status_rank(status: TZAnalysisStatus) -> int:
    return _STATUS_RANK.get(status, 0)


def _summarize_found(found: dict[str, TZAnalysisItem]) -> dict[str, int]:
    """Return match counters for progress logging."""
    return {
        "found_total": len(found),
        "met": sum(
            1 for item in found.values() if item.status == TZAnalysisStatus.MET
        ),
        "partial": sum(
            1
            for item in found.values()
            if item.status == TZAnalysisStatus.PARTIAL
        ),
        "missing": sum(
            1
            for item in found.values()
            if item.status == TZAnalysisStatus.MISSING
        ),
        "not_found": sum(
            1
            for item in found.values()
            if item.status == TZAnalysisStatus.NOT_FOUND
        ),
    }


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


def _apply_item_tz_ref_fields(
    item: TZAnalysisItem,
    hierarchy: dict | None,
) -> TZAnalysisItem:
    """Fill ref/ref_value from hierarchy for letter and source references."""
    req_key = requirement_key_from_flat(item.requirement)
    ref = item.ref
    ref_value = item.ref_value
    if hierarchy and req_key:
        resolved_ref, resolved_ref_value = resolve_letter_tz_fields(
            hierarchy,
            req_key,
        )
        ref = ref or resolved_ref
        ref_value = ref_value or resolved_ref_value
    return item.model_copy(update={"ref": ref, "ref_value": ref_value})


def _ensure_item_refs(
    items: list[TZAnalysisItem],
    tz_hierarchy: dict | None = None,
) -> list[TZAnalysisItem]:
    """Fill missing refs and strip page numbers from LLM output."""
    updated: list[TZAnalysisItem] = []
    for item in items:
        item = _apply_item_tz_ref_fields(item, tz_hierarchy)
        req_key = requirement_key_from_flat(item.requirement)
        letter_key = item.ref or req_key
        letter_text = item.ref_value
        if not letter_text and req_key:
            parts = item.requirement.strip().split(". ", 1)
            letter_text = (
                parts[1] if len(parts) > 1 else item.requirement.strip()
            )

        requirement_ref = strip_page_from_ref(item.requirement_ref)
        if letter_key and letter_text:
            requirement_ref = format_tz_requirement_ref(
                letter_key,
                None,
                f"{letter_key}. {letter_text}",
                quote=letter_text,
            )
        elif not requirement_ref and req_key:
            requirement_ref = format_tz_requirement_ref(
                req_key,
                None,
                item.requirement,
                quote=item.ref_value,
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
                    "ref": item.ref,
                    "ref_value": item.ref_value,
                    "requirement_ref": requirement_ref,
                    "offer_ref": offer_ref,
                },
            ),
        )
    return updated


def _needs_recall(item: TZAnalysisItem | None) -> bool:
    if item is None:
        return True
    return item.status == TZAnalysisStatus.NOT_FOUND


def _compact_kp_text(
    kp_text: str, *, max_chars: int = _RECALL_KP_MAX_CHARS
) -> str:
    """Build compact raw KP text for recall sweep."""
    cleaned = clean_text(kp_text)
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[: max_chars - 20].rstrip() + "\n...[КП обрезан]"


def _remaining_tz_requirements(
    tz_flat: list[str],
    found: dict[str, TZAnalysisItem],
) -> list[str]:
    """Return TZ requirements not yet matched with met/partial/missing."""
    remaining: list[str] = []
    for requirement in tz_flat:
        req_key = requirement_key_from_flat(requirement) or ""
        if _needs_recall(found.get(req_key)):
            remaining.append(requirement)
    return remaining


async def _llm_match_chunk_batch(
    tz_batch: list[str],
    kp_chunk: str,
    *,
    kp_name: str,
    kp_chunk_idx: int,
    total_kp_chunks: int,
    tz_batch_idx: int,
    total_tz_batches: int,
    analysis_id: str,
    user_id: str,
    tz_hierarchy: dict | None = None,
) -> list[TZAnalysisItem]:
    """Match a TZ batch against a raw KP chunk."""
    if not tz_batch or not kp_chunk.strip():
        return []

    system, user = build_kp_match_chunk_prompt(
        tz_batch,
        kp_chunk,
        kp_name,
        kp_chunk_idx=kp_chunk_idx,
        total_kp_chunks=total_kp_chunks,
        tz_batch_idx=tz_batch_idx,
        total_tz_batches=total_tz_batches,
    )
    parsed = await _llm_call_with_retry(
        system,
        user,
        TZAnalysisResult,
        analysis_id=analysis_id,
        user_id=user_id,
        stage="chunk_match",
        context={
            "kp_name": kp_name,
            "kp_chunk": kp_chunk_idx + 1,
            "batch": tz_batch_idx + 1,
        },
    )
    by_requirement = {
        requirement_key_from_flat(item.requirement)
        or item.requirement.strip(): item.model_copy(
            update={"kp_name": kp_name},
        )
        for item in parsed.items
    }
    items: list[TZAnalysisItem] = []
    for req in tz_batch:
        req_key = requirement_key_from_flat(req) or req.strip()
        item = by_requirement.get(req_key) or by_requirement.get(req.strip())
        if item is None:
            continue
        if item.requirement.strip() != req.strip():
            item = item.model_copy(update={"requirement": req})
        items.append(item)
    return _ensure_item_refs(items, tz_hierarchy)


async def _run_direct_chunk_matching(
    kp_text: str,
    tz_flat: list[str],
    kp_name: str,
    *,
    analysis_id: str,
    user_id: str,
    tz_hierarchy: dict | None = None,
) -> dict[str, TZAnalysisItem]:
    """Match TZ requirements against raw KP chunks."""
    cleaned = clean_text(kp_text)
    chunks = chunk_text(cleaned)
    if not chunks:
        logger.warning(
            "Direct chunk matching skipped",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            reason="empty_text",
        )
        return {}

    logger.info(
        "Direct chunk matching started",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        text_chars=len(cleaned),
        chunks=len(chunks),
        requirements=len(tz_flat),
    )

    found: dict[str, TZAnalysisItem] = {}
    sem = asyncio.Semaphore(_COMPLIANCE_CONCURRENCY)

    for chunk_idx, kp_chunk in enumerate(chunks):
        remaining = _remaining_tz_requirements(tz_flat, found)
        if not remaining:
            break

        batches = _batch_requirements(remaining, _CHUNK_MATCH_BATCH_SIZE)
        total_batches = len(batches)
        logger.info(
            "Chunk match processing",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            chunk=chunk_idx + 1,
            total=len(chunks),
            remaining=len(remaining),
            batches=total_batches,
        )

        async def _run_batch(
            tz_batch: list[str],
            batch_idx: int,
            kp_chunk_text: str,
            current_chunk_idx: int,
            batch_count: int,
        ) -> list[TZAnalysisItem]:
            async with sem:
                return await _llm_match_chunk_batch(
                    tz_batch,
                    kp_chunk_text,
                    kp_name=kp_name,
                    kp_chunk_idx=current_chunk_idx,
                    total_kp_chunks=len(chunks),
                    tz_batch_idx=batch_idx,
                    total_tz_batches=batch_count,
                    analysis_id=analysis_id,
                    user_id=user_id,
                    tz_hierarchy=tz_hierarchy,
                )

        batch_results = await asyncio.gather(
            *[
                _run_batch(
                    tz_batch,
                    batch_idx,
                    kp_chunk,
                    chunk_idx,
                    total_batches,
                )
                for batch_idx, tz_batch in enumerate(batches)
            ],
        )
        for items in batch_results:
            for item in items:
                _merge_match_item(found, item, kp_name=kp_name)

        logger.info(
            "Chunk match done",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            chunk=chunk_idx + 1,
            total=len(chunks),
            **_summarize_found(found),
        )

    logger.info(
        "Direct chunk matching finished",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        **_summarize_found(found),
    )
    return found


async def _run_recall_sweep(
    tz_flat: list[str],
    found: dict[str, TZAnalysisItem],
    kp_text: str,
    *,
    kp_name: str,
    analysis_id: str,
    user_id: str,
    tz_hierarchy: dict | None = None,
) -> None:
    """Second pass over still-unmatched requirements using compact KP text."""
    recall_candidates = _remaining_tz_requirements(tz_flat, found)
    if not recall_candidates:
        return

    total = len(tz_flat)
    if total == 0:
        return

    not_found_ratio = len(recall_candidates) / total
    if not_found_ratio < _RECALL_MIN_NOT_FOUND_RATIO:
        logger.info(
            "Recall sweep skipped",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            candidates=len(recall_candidates),
            total=total,
            not_found_ratio=round(not_found_ratio, 3),
            threshold=_RECALL_MIN_NOT_FOUND_RATIO,
        )
        return

    compact_kp = _compact_kp_text(kp_text)
    recall_batches = _batch_requirements(recall_candidates, _RECALL_BATCH_SIZE)
    logger.info(
        "Recall sweep started",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        candidates=len(recall_candidates),
        batches=len(recall_batches),
        kp_chars=len(compact_kp),
    )

    for batch_idx, tz_batch in enumerate(recall_batches):
        logger.info(
            "Recall batch processing",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            batch=batch_idx + 1,
            total=len(recall_batches),
            requirements=len(tz_batch),
        )
        items = await _llm_recall_batch(
            tz_batch,
            compact_kp,
            batch_idx=batch_idx,
            total_batches=len(recall_batches),
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            tz_hierarchy=tz_hierarchy,
        )
        for item in items:
            _merge_match_item(found, item, kp_name=kp_name)
        logger.info(
            "Recall batch done",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            batch=batch_idx + 1,
            total=len(recall_batches),
            **_summarize_found(found),
        )


async def _run_staged_kp_analysis(
    kp_text: str,
    tz_flat: list[str],
    tz_hierarchy: dict,
    kp_name: str,
    *,
    analysis_id: str,
    user_id: str,
) -> tuple[list[TZAnalysisItem], dict]:
    """Run KP analysis: direct chunk matching, recall sweep, display digest."""
    logger.info(
        "KP analysis started",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        tz_requirements=len(tz_flat),
    )

    found = await _run_direct_chunk_matching(
        kp_text,
        tz_flat,
        kp_name,
        analysis_id=analysis_id,
        user_id=user_id,
        tz_hierarchy=tz_hierarchy,
    )
    await _run_recall_sweep(
        tz_flat,
        found,
        kp_text,
        kp_name=kp_name,
        analysis_id=analysis_id,
        user_id=user_id,
        tz_hierarchy=tz_hierarchy,
    )

    items = _build_not_found_items(
        tz_flat,
        found,
        kp_name=kp_name,
        tz_hierarchy=tz_hierarchy,
    )

    digest = await _normalize_kp_to_digest(
        kp_text,
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
    )
    hierarchy = _digest_to_hierarchy(digest)

    logger.info(
        "KP analysis finished",
        analysis_id=analysis_id,
        user_id=user_id,
        kp_name=kp_name,
        matched=sum(
            1 for item in items if item.status != TZAnalysisStatus.NOT_FOUND
        ),
        not_found=sum(
            1 for item in items if item.status == TZAnalysisStatus.NOT_FOUND
        ),
    )
    return items, hierarchy


def _build_not_found_items(
    tz_flat: list[str],
    found: dict[str, TZAnalysisItem],
    *,
    kp_name: str,
    tz_hierarchy: dict | None = None,
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
    return _ensure_item_refs(items, tz_hierarchy)


async def _match_kp_paths_against_tz(
    kp_paths: list[Path],
    tz_flat: list[str],
    tz_hierarchy: dict,
    kp_name: str,
    *,
    analysis_id: str,
    user_id: str,
) -> tuple[list[TZAnalysisItem], dict]:
    """Match one or more KP files against TZ using staged pipeline."""
    combined_text_parts: list[str] = []
    for kp_path in kp_paths:
        logger.info(
            "KP file read started",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            path=str(kp_path),
        )
        raw_text = _assembler.assemble(_router.get(kp_path).extract(kp_path))
        combined_text_parts.append(raw_text)
        logger.info(
            "KP file read finished",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            path=str(kp_path),
            chars=len(raw_text),
        )

    combined_text = "\n\n".join(combined_text_parts)
    return await _run_staged_kp_analysis(
        combined_text,
        tz_flat,
        tz_hierarchy,
        kp_name,
        analysis_id=analysis_id,
        user_id=user_id,
    )


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
            tz_hierarchy,
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
            tz_hierarchy,
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
