"""Unit tests for TZ creation wizard turn parsing and state merging."""

import pytest
from backend.services.analysis.tz_creation import (
    TZCreationTurnError,
    _merge_fields,
    _merge_hierarchy_patch,
    _parse_turn_result,
    apply_turn_result,
    get_cached_requirement_hint,
    requirement_text_hash,
)


def test_parse_turn_result_normalizes_missing_fields():
    parsed = _parse_turn_result({"assistant_message": "  Привет  "})
    assert parsed == {
        "assistant_message": "Привет",
        "hierarchy_patch": {},
        "fields_update": [],
        "open_questions": [],
        "suggested_done": False,
    }


def test_parse_turn_result_rejects_non_dict_payload():
    with pytest.raises(TZCreationTurnError):
        _parse_turn_result("not a dict")


def test_merge_fields_upserts_by_key_and_preserves_order():
    existing = [
        {
            "key": "capacity",
            "label": "Производительность",
            "value": "",
            "status": "pending",
            "requirement_key": "2.1",
            "confirmed": False,
        },
        {
            "key": "power",
            "label": "Мощность",
            "value": "5 кВт",
            "status": "answered",
            "confirmed": True,
        },
    ]
    updates = [
        {
            "key": "capacity",
            "label": "Производительность",
            "value": "100 кг/ч",
            "status": "answered",
        },
        {
            "key": "warranty",
            "label": "Гарантия",
            "value": "12 месяцев",
            "status": "answered",
            "requirement_key": "5.1",
        },
    ]

    merged = _merge_fields(existing, updates)

    assert [f["key"] for f in merged] == ["capacity", "power", "warranty"]
    assert merged[0]["value"] == "100 кг/ч"
    assert merged[0]["status"] == "answered"
    assert merged[0]["requirement_key"] == "2.1"
    assert merged[0]["confirmed"] is False  # LLM changed value → reset
    assert merged[1]["value"] == "5 кВт"  # untouched by updates
    assert merged[1]["confirmed"] is True
    assert merged[2]["label"] == "Гарантия"
    assert merged[2]["requirement_key"] == "5.1"
    assert merged[2]["confirmed"] is False


def test_merge_fields_preserves_confirmed_when_value_unchanged():
    existing = [
        {
            "key": "capacity",
            "label": "Производительность",
            "value": "100 кг/ч",
            "status": "answered",
            "confirmed": True,
        }
    ]
    updates = [
        {
            "key": "capacity",
            "label": "Производительность",
            "value": "100 кг/ч",
            "status": "suggested",
        }
    ]
    merged = _merge_fields(existing, updates)
    assert merged[0]["confirmed"] is True
    assert merged[0]["status"] == "suggested"


def test_merge_fields_ignores_malformed_entries():
    merged = _merge_fields(
        [{"key": "capacity", "label": "Производительность"}],
        [{"no_key": "x"}, "not-a-dict", None],
    )
    assert len(merged) == 1
    assert merged[0]["key"] == "capacity"


def test_merge_hierarchy_patch_adds_new_nested_node():
    draft = {"1": {"text": "Общие требования", "children": {}}}
    patch = {"1.1": {"text": "Новый пункт", "children": {}}}

    merged = _merge_hierarchy_patch(draft, patch)

    assert merged["1"]["text"] == "Общие требования"
    assert merged["1"]["children"]["1.1"]["text"] == "Новый пункт"


def test_merge_hierarchy_patch_noop_for_empty_patch():
    draft = {"1": {"text": "Общие требования", "children": {}}}
    assert _merge_hierarchy_patch(draft, {})["1"]["text"] == "Общие требования"


def test_apply_turn_result_merges_hierarchy_and_fields_together():
    result = {
        "assistant_message": "ok",
        "hierarchy_patch": {
            "2": {"text": "Технические характеристики", "children": {}}
        },
        "fields_update": [
            {
                "key": "capacity",
                "label": "Производительность",
                "value": "100 кг/ч",
                "status": "answered",
            }
        ],
        "open_questions": ["Какой срок поставки?"],
        "suggested_done": False,
    }

    hierarchy, fields, open_questions = apply_turn_result(
        draft_hierarchy={"1": {"text": "Общие требования", "children": {}}},
        fields=[],
        result=result,
    )

    assert set(hierarchy.keys()) == {"1", "2"}
    assert fields[0]["key"] == "capacity"
    assert fields[0]["value"] == "100 кг/ч"
    assert open_questions == ["Какой срок поставки?"]


def test_get_cached_requirement_hint_matches_text_hash():
    text = "Производительность не менее 100 кг/ч"
    hints = {
        "2.1": {
            "text": "Уточните единицы измерения и условия приёмки.",
            "requirement_text": text,
            "text_hash": requirement_text_hash(text),
            "model": "test-model",
            "generated_at": "2026-07-29T00:00:00+00:00",
        }
    }
    cached = get_cached_requirement_hint(hints, "2.1", text)
    assert cached is not None
    assert cached["cached"] is True
    assert "единицы" in cached["text"]

    stale = get_cached_requirement_hint(hints, "2.1", text + " (изм.)")
    assert stale is None
