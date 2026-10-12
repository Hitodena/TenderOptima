"""A small offer, a small TZ and a stand-in for the model."""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Callable

from pydantic import BaseModel

from backend.utils.requirements_struct import (
    flatten_hierarchy_for_matching,
    normalize_tz_requirements,
)

OFFER = """--- Страница 1 ---
ACME s.r.l. Via Roma 1
OFFER N. 7
Item 1
n. 2 CHEESE VAT, mod. CV10
Maximum capacity: 10.000 liters, each one.
Insulation : ................................ 50 mm
Control panel made of AISI 304 stainless steel.
Item 2
n. 1 CIP PUMP for the cleaning station
Centrifugal pump, 5 kW, DN 50, for the CIP solutions.
--- Страница 2 ---
ACME s.r.l. Via Roma 1
DEVIATIONS LIST
Section 2.1 – pag.3
Buffer tank for pasteurized water – not included in ACME's scope.
EXCLUSIONS / LIMITS OF SUPPLY
This Quotation does not include:
Pasteurized water tank, valves and pump.
"""

OUTLINE = [
    {"anchor": "Item 1", "position": "Item 1", "title": "Item 1"},
    {
        "anchor": "n. 2 CHEESE VAT, mod. CV10",
        "title": "CHEESE VAT, mod. CV10",
        "title_ru": "Сыроизготовитель",
        "kind": "equipment",
    },
    {
        "anchor": "Item 2",
        "position": "Item 2",
        "title": "CIP PUMP",
        "title_ru": "Насос мойки",
        "kind": "equipment",
    },
    {"anchor": "DEVIATIONS LIST", "title": "DEVIATIONS", "kind": "deviations"},
    {
        "anchor": "EXCLUSIONS / LIMITS OF SUPPLY",
        "title": "EXCLUSIONS",
        "kind": "exclusions",
    },
]


def _node(number: str, text: str, children: dict | None = None) -> dict:
    return {
        "text": text,
        "label": f"{number}.",
        "number": number,
        "children": children or {},
    }


TZ = {
    "1": _node(
        "1",
        "Сыроизготовитель:",
        {
            "1.1": _node("1.1", "рабочий объём не менее 8 000 л;"),
            "1.2": _node("1.2", "теплоизоляция не менее 50 мм;"),
            "1.3": _node("1.3", "насос подачи сыворотки DN 50;"),
        },
    ),
    "2": _node(
        "2",
        "Вспомогательное оборудование",
        {
            "2.1": _node(
                "2.1",
                "Буферная ёмкость для пастеризованной воды:",
                {
                    "2.1.1": _node("2.1.1", "полезный объём не менее 10 м3;"),
                    "2.1.2": _node("2.1.2", "обшивка из стали AISI 304;"),
                },
            )
        },
    ),
    "3": _node("3", "Гарантия не менее 24 месяцев."),
}


def tz() -> tuple[dict, list[str]]:
    hierarchy = normalize_tz_requirements(TZ)
    return hierarchy, flatten_hierarchy_for_matching(hierarchy)


Handler = Callable[[str, str, str], dict]


class FakeCalls:
    """Answers model calls from a handler; records every prompt."""

    def __init__(self, handler: Handler) -> None:
        self.handler = handler
        self.analysis_id = "test"
        self.user_id = "test"
        self.kp_name = "КП"
        self.stats: Counter[str] = Counter()
        self.prompts: list[tuple[str, str, bool]] = []

    async def json(
        self,
        stage: str,
        system: str,
        user: str,
        result_model: type[BaseModel],
        *,
        attempts: int = 2,
        thinking: bool = True,
    ):
        self.prompts.append((stage, user, thinking))
        self.stats[f"{stage}:calls"] += 1
        return result_model.model_validate(self.handler(stage, system, user))

    async def close(self) -> None:
        return None


def points_in(user: str) -> dict[str, str]:
    """R-id -> TZ number for the points listed in a verdict prompt."""
    return dict(re.findall(r"^(R\d+)\. \[ТЗ п\. ([^\]]+)\]", user, re.M))
