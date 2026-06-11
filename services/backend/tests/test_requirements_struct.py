from backend.utils.requirements_struct import (
    count_requirements,
    flatten_hierarchy,
    normalize_tz_requirements,
)


def test_canonicalize_orphan_dotted_keys_under_parent_heading() -> None:
    raw = {
        "3.1": {
            "text": "Сыроизготовитель объемом не менее 8 000 л - 3 единицы",
            "children": {},
        },
        "3.2": {
            "text": "Линии транспортировки и асидификации зерна — 3 единицы",
            "children": {},
        },
    }

    hierarchy = normalize_tz_requirements(raw)

    assert "3" in hierarchy
    assert hierarchy["3"]["text"] == ""
    assert "3.1" in hierarchy["3"]["children"]
    assert "3.2" in hierarchy["3"]["children"]
    assert hierarchy["3"]["children"]["3.1"]["text"].startswith(
        "Сыроизготовитель"
    )
    assert count_requirements(hierarchy) == 2


def test_heading_with_children_is_not_counted_or_flattened() -> None:
    raw = {
        "2": {
            "text": "Предлагаемое оборудование должно быть четко описано",
            "children": {},
        },
        "3": {
            "text": "Оборудование для производства сыра",
            "children": {
                "3.1": {
                    "text": "Сыроизготовитель объемом не менее 8 000 л",
                    "children": {},
                },
                "3.2": {
                    "text": "Линии транспортировки — 3 единицы",
                    "children": {},
                },
            },
        },
    }

    hierarchy = normalize_tz_requirements(raw)
    flat = flatten_hierarchy(hierarchy)

    assert count_requirements(hierarchy) == 3
    assert flat == [
        "2. Предлагаемое оборудование должно быть четко описано",
        "3.1. Сыроизготовитель объемом не менее 8 000 л",
        "3.2. Линии транспортировки — 3 единицы",
    ]
    assert not any(line.startswith("3. Оборудование") for line in flat)


def test_merge_top_level_heading_with_orphan_children() -> None:
    raw = {
        "3": {
            "text": "Оборудование для производства сыра",
            "children": {},
        },
        "3.1": {
            "text": "Сыроизготовитель объемом не менее 8 000 л",
            "children": {},
        },
    }

    hierarchy = normalize_tz_requirements(raw)

    assert hierarchy["3"]["text"] == "Оборудование для производства сыра"
    assert "3.1" in hierarchy["3"]["children"]
    assert count_requirements(hierarchy) == 1
