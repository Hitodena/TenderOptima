"""Business logic for the TZ creation wizard (Module 3).

Owns the chat-turn contract (orienting / intake / kickoff / gap-analysis /
follow-up turns) and merges LLM responses into session state (draft
hierarchy + side panel fields + open questions), keeping the API router
focused on HTTP/DB glue.
"""

import hashlib
from datetime import UTC, datetime

from backend.core.config import get_config
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.tz_creation import (
    TZCreationContext,
    build_field_hint_prompt,
    build_requirement_hint_prompt,
    build_tz_creation_turn_prompt,
    build_tz_gap_analysis_prompt,
    build_tz_kickoff_prompt,
    build_tz_orienting_questions_prompt,
    build_tz_post_upload_intake_prompt,
)
from backend.utils.requirements_struct import (
    RequirementNode,
    find_node_by_key,
    merge_requirement_chunks,
    normalize_tz_requirements,
)

config = get_config()

TZCreationField = dict[str, str | bool | None]


class TZCreationTurnError(Exception):
    """Raised when the LLM response for a wizard turn is malformed."""


def requirement_text_hash(text: str) -> str:
    """Stable hash of requirement text used for hint cache invalidation."""
    normalized = (text or "").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _parse_assistant_message_only(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise TZCreationTurnError("Malformed LLM response for TZ wizard turn")
    message = str(raw.get("assistant_message") or "").strip()
    if not message:
        raise TZCreationTurnError("Empty assistant_message from LLM")
    return {"assistant_message": message}


def _parse_open_questions(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    result: list[str] = []
    for item in raw:
        text = str(item or "").strip()
        if text:
            result.append(text)
    return result


def _parse_turn_result(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise TZCreationTurnError("Malformed LLM response for TZ wizard turn")
    hierarchy_patch = raw.get("hierarchy_patch")
    fields_update = raw.get("fields_update")
    return {
        "assistant_message": str(raw.get("assistant_message") or "").strip(),
        "hierarchy_patch": hierarchy_patch
        if isinstance(hierarchy_patch, dict)
        else {},
        "fields_update": fields_update
        if isinstance(fields_update, list)
        else [],
        "open_questions": _parse_open_questions(raw.get("open_questions")),
        "suggested_done": bool(raw.get("suggested_done")),
    }


def _merge_fields(
    existing: list[TZCreationField],
    updates: list[object],
) -> list[TZCreationField]:
    """Upsert fields by ``key``, preserving order of first appearance.

    ``confirmed`` is user-owned: reset to False when the LLM sends a new
    non-empty ``value`` that differs from the current one; otherwise keep
    the existing flag. LLM responses never set ``confirmed`` themselves.
    """
    merged: dict[str, TZCreationField] = {}
    order: list[str] = []
    for field in existing:
        if not isinstance(field, dict):
            continue
        key = str(field.get("key") or "").strip()
        if not key:
            continue
        req_key = field.get("requirement_key")
        req_key_text = str(req_key).strip() if req_key is not None else ""
        merged[key] = {
            "key": key,
            "label": str(field.get("label") or key),
            "value": str(field.get("value") or ""),
            "status": str(field.get("status") or "pending"),
            "requirement_key": req_key_text or None,
            "confirmed": bool(field.get("confirmed")),
        }
        order.append(key)

    for update in updates:
        if not isinstance(update, dict):
            continue
        key = str(update.get("key") or "").strip()
        if not key:
            continue
        current = merged.get(key, {})
        req_key = update.get("requirement_key")
        if req_key is None:
            req_key = current.get("requirement_key")
        req_key_text = str(req_key).strip() if req_key is not None else ""
        new_value = str(update.get("value") or current.get("value") or "")
        old_value = str(current.get("value") or "")
        value_changed_by_llm = (
            "value" in update and new_value != old_value and bool(new_value)
        )
        confirmed = bool(current.get("confirmed"))
        if value_changed_by_llm:
            confirmed = False
        merged[key] = {
            "key": key,
            "label": str(update.get("label") or current.get("label") or key),
            "value": new_value,
            "status": str(update.get("status") or "pending"),
            "requirement_key": req_key_text or None,
            "confirmed": confirmed,
        }
        if key not in order:
            order.append(key)

    return [merged[key] for key in order]


def _merge_hierarchy_patch(
    draft_hierarchy: dict[str, RequirementNode],
    patch: dict,
) -> dict[str, RequirementNode]:
    normalized_draft = normalize_tz_requirements(draft_hierarchy)
    if not patch:
        return normalized_draft
    normalized_patch = normalize_tz_requirements(patch)
    merged = merge_requirement_chunks([normalized_draft, normalized_patch])
    return normalize_tz_requirements(merged)


async def run_orienting_questions_turn(
    context: TZCreationContext | None,
) -> dict:
    """Opening assistant message for from_scratch (no structure yet)."""
    system, user = build_tz_orienting_questions_prompt(context)
    raw = await llm_client.complete(
        system, user, model=config.openai_model_for_tz_create()
    )
    return _parse_assistant_message_only(raw)


async def run_post_upload_intake_turn(
    hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None,
) -> dict:
    """Opening assistant message after refine_existing extract."""
    system, user = build_tz_post_upload_intake_prompt(hierarchy, context)
    raw = await llm_client.complete(
        system, user, model=config.openai_model_for_tz_create()
    )
    return _parse_assistant_message_only(raw)


async def run_kickoff_turn(
    user_idea: str,
    context: TZCreationContext | None,
    *,
    history: list[dict[str, str]] | None = None,
) -> dict:
    """First generative turn for the "from scratch" scenario."""
    system, user = build_tz_kickoff_prompt(user_idea, context)
    raw = await llm_client.complete(
        system,
        user,
        model=config.openai_model_for_tz_create(),
        history=history,
    )
    return _parse_turn_result(raw)


async def run_gap_analysis_turn(
    hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None,
    *,
    history: list[dict[str, str]] | None = None,
) -> dict:
    """Opening generative turn for refine_existing after user intake reply."""
    system, user = build_tz_gap_analysis_prompt(hierarchy, context)
    raw = await llm_client.complete(
        system,
        user,
        model=config.openai_model_for_tz_create(),
        history=history,
    )
    return _parse_turn_result(raw)


async def run_chat_turn(
    draft_hierarchy: dict[str, RequirementNode],
    fields: list[TZCreationField],
    user_message: str,
    context: TZCreationContext | None,
    *,
    history: list[dict[str, str]] | None = None,
) -> dict:
    """Every follow-up turn in both scenarios."""
    system, user = build_tz_creation_turn_prompt(
        draft_hierarchy, fields, user_message, context
    )
    raw = await llm_client.complete(
        system,
        user,
        model=config.openai_model_for_tz_create(),
        history=history,
    )
    return _parse_turn_result(raw)


async def run_requirement_hint_turn(
    requirement_key: str,
    requirement_text: str,
    draft_hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None,
) -> str:
    """Generate a short tip for one outline item."""
    system, user = build_requirement_hint_prompt(
        requirement_key,
        requirement_text,
        draft_hierarchy,
        context,
    )
    raw = await llm_client.complete(
        system, user, model=config.openai_model_for_tz_create()
    )
    if not isinstance(raw, dict):
        raise TZCreationTurnError(
            "Malformed LLM response for requirement hint"
        )
    hint = str(raw.get("hint") or "").strip()
    if not hint:
        raise TZCreationTurnError("Empty LLM hint for requirement")
    return hint


async def run_field_hint_turn(
    field_key: str,
    field_label: str,
    field_value: str,
    requirement_text: str | None,
    draft_hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None,
) -> str:
    """Generate a short tip for one «Параметры ТЗ» parameter."""
    system, user = build_field_hint_prompt(
        field_key,
        field_label,
        field_value,
        requirement_text,
        draft_hierarchy,
        context,
    )
    raw = await llm_client.complete(
        system, user, model=config.openai_model_for_tz_create()
    )
    if not isinstance(raw, dict):
        raise TZCreationTurnError("Malformed LLM response for field hint")
    hint = str(raw.get("hint") or "").strip()
    if not hint:
        raise TZCreationTurnError("Empty LLM hint for field")
    return hint


def build_requirement_hint_payload(
    *,
    requirement_key: str,
    requirement_text: str,
    hint_text: str,
    model: str,
    cached: bool = False,
    generated_at: datetime | None = None,
) -> dict:
    """Normalize a hint dict stored in session.requirement_hints."""
    return {
        "text": hint_text.strip(),
        "requirement_text": requirement_text.strip(),
        "text_hash": requirement_text_hash(requirement_text),
        "model": model,
        "generated_at": (generated_at or datetime.now(UTC)).isoformat(),
        "cached": cached,
        "requirement_key": requirement_key,
    }


def get_cached_requirement_hint(
    hints: object,
    requirement_key: str,
    requirement_text: str,
) -> dict | None:
    """Return a cached hint when text hash still matches."""
    if not isinstance(hints, dict):
        return None
    entry = hints.get(requirement_key)
    if not isinstance(entry, dict):
        return None
    cached_hash = str(entry.get("text_hash") or "")
    if cached_hash != requirement_text_hash(requirement_text):
        return None
    return {
        "text": str(entry.get("text") or "").strip(),
        "requirement_text": str(
            entry.get("requirement_text") or requirement_text
        ).strip(),
        "text_hash": cached_hash,
        "model": str(entry.get("model") or ""),
        "generated_at": entry.get("generated_at"),
        "cached": True,
        "requirement_key": requirement_key,
    }


def resolve_requirement_text(
    draft_hierarchy: dict[str, RequirementNode],
    requirement_key: str,
) -> str | None:
    """Return node text for a dotted key, or None if missing."""
    hierarchy = normalize_tz_requirements(draft_hierarchy)
    node = find_node_by_key(hierarchy, requirement_key)
    if not node:
        return None
    return str(node.get("text") or "").strip()


def apply_turn_result(
    *,
    draft_hierarchy: dict[str, RequirementNode],
    fields: list[TZCreationField],
    result: dict,
) -> tuple[dict[str, RequirementNode], list[TZCreationField], list[str]]:
    """Merge a parsed turn result into session state."""
    merged_hierarchy = _merge_hierarchy_patch(
        draft_hierarchy, result["hierarchy_patch"]
    )
    merged_fields = _merge_fields(fields, result["fields_update"])
    open_questions = list(result.get("open_questions") or [])
    return merged_hierarchy, merged_fields, open_questions
