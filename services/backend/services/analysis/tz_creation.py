"""Business logic for the TZ creation wizard (Module 3).

Owns the chat-turn contract (kickoff / gap-analysis / follow-up turns)
and merges LLM responses into session state (draft hierarchy + side
panel fields), keeping the API router focused on HTTP/DB glue.
"""

from backend.core.config import get_config
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.tz_creation import (
    TZCreationContext,
    build_tz_creation_turn_prompt,
    build_tz_gap_analysis_prompt,
    build_tz_kickoff_prompt,
)
from backend.utils.requirements_struct import (
    RequirementNode,
    merge_requirement_chunks,
    normalize_tz_requirements,
)

config = get_config()

TZCreationField = dict[str, str]


class TZCreationTurnError(Exception):
    """Raised when the LLM response for a wizard turn is malformed."""


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
        "suggested_done": bool(raw.get("suggested_done")),
    }


def _merge_fields(
    existing: list[TZCreationField],
    updates: list[object],
) -> list[TZCreationField]:
    """Upsert fields by ``key``, preserving order of first appearance."""
    merged: dict[str, TZCreationField] = {}
    order: list[str] = []
    for field in existing:
        if not isinstance(field, dict):
            continue
        key = str(field.get("key") or "").strip()
        if not key:
            continue
        merged[key] = {
            "key": key,
            "label": str(field.get("label") or key),
            "value": str(field.get("value") or ""),
            "status": str(field.get("status") or "pending"),
        }
        order.append(key)

    for update in updates:
        if not isinstance(update, dict):
            continue
        key = str(update.get("key") or "").strip()
        if not key:
            continue
        current = merged.get(key, {})
        merged[key] = {
            "key": key,
            "label": str(update.get("label") or current.get("label") or key),
            "value": str(update.get("value") or current.get("value") or ""),
            "status": str(update.get("status") or "pending"),
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


async def run_kickoff_turn(
    user_idea: str,
    context: TZCreationContext | None,
) -> dict:
    """First turn for the "from scratch" scenario."""
    system, user = build_tz_kickoff_prompt(user_idea, context)
    raw = await llm_client.complete(
        system, user, model=config.openai_model_for_tz_create()
    )
    return _parse_turn_result(raw)


async def run_gap_analysis_turn(
    hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None,
) -> dict:
    """Opening turn for the "refine existing" scenario, run right after
    the uploaded TZ has been extracted into a hierarchy."""
    system, user = build_tz_gap_analysis_prompt(hierarchy, context)
    raw = await llm_client.complete(
        system, user, model=config.openai_model_for_tz_create()
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


def apply_turn_result(
    *,
    draft_hierarchy: dict[str, RequirementNode],
    fields: list[TZCreationField],
    result: dict,
) -> tuple[dict[str, RequirementNode], list[TZCreationField]]:
    """Merge a parsed turn result into session state."""
    merged_hierarchy = _merge_hierarchy_patch(
        draft_hierarchy, result["hierarchy_patch"]
    )
    merged_fields = _merge_fields(fields, result["fields_update"])
    return merged_hierarchy, merged_fields
