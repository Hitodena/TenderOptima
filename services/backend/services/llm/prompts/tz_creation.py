"""Prompts for the TZ creation wizard (Module 3).

Two entry scenarios feed the same iterative "turn" loop:

- ``refine_existing`` — an uploaded TZ is extracted with the existing
  Module 2 pipeline, then :func:`build_tz_gap_analysis_prompt` produces
  the wizard's opening assistant message (missing sections, risks,
  clarifying questions).
- ``from_scratch`` — the user describes an abstract idea and
  :func:`build_tz_kickoff_prompt` proposes an initial outline skeleton
  plus the clarifying parameters to collect.

Every following turn (both scenarios) goes through
:func:`build_tz_creation_turn_prompt`, which always returns the same
JSON contract so the backend can apply it uniformly.
"""

import json

from backend.utils.requirements_struct import RequirementNode

TZCreationContext = dict[str, str | None]

_DOMAIN_LABELS: dict[str, str] = {
    "equipment": "оборудование",
    "food": "пищевая продукция",
    "services": "услуги",
    "other": "прочее",
}

_DOMAIN_HINTS: dict[str, str] = {
    "equipment": """\
Тип закупки — ОБОРУДОВАНИЕ. Обязательно учитывай типовые риски и не забывай \
уточнить/предложить:
- гарантийные обязательства, срок гарантии, условия гарантийного обслуживания
- комплект ЗИП (запасных частей), доступность расходных материалов
- монтаж, пусконаладочные работы, обучение персонала заказчика
- технические характеристики (производительность, габариты, вес, \
энергопотребление, класс электробезопасности)
- соответствие стандартам (ГОСТ Р, ТР ТС 010/2011 «О безопасности машин и \
оборудования», при пищевом оборудовании — дополнительно нормы контакта с \
пищевой продукцией)
- условия эксплуатации (климатическое исполнение, требования к помещению, \
электропитанию, вентиляции)
- комплектность поставки, техническая документация (паспорт, руководство \
по эксплуатации, сертификат/декларация соответствия)
- условия транспортировки, разгрузки, ответственность за повреждения""",
    "food": """\
Тип закупки — ПИЩЕВАЯ ПРОДУКЦИЯ. Обязательно учитывай типовые риски и не \
забывай уточнить/предложить:
- соответствие ТР ТС 021/2011 «О безопасности пищевой продукции» и \
профильным техническим регламентам (ТР ТС 022/2011 по маркировке и др.)
- сроки годности на момент поставки (минимальный остаточный срок годности)
- условия хранения и транспортировки (температурный режим, влажность)
- упаковка, маркировка, партионность, страна происхождения сырья
- декларация/сертификат соответствия, ветеринарные сопроводительные \
документы (при необходимости)
- органолептические и физико-химические показатели качества
- порядок контроля качества и приёмки партии, право на возврат/замену \
несоответствующей продукции""",
    "services": """\
Тип закупки — УСЛУГИ. Обязательно учитывай типовые риски и не забывай \
уточнить/предложить:
- сроки и этапы оказания услуги, SLA (уровень обслуживания)
- зона ответственности сторон, порядок приёмки результата
- необходимые лицензии, допуски, квалификация исполнителя
- порядок оплаты, штрафные санкции за нарушение сроков/качества""",
    "other": """\
Тип закупки не уточнён отдельной категорией — ориентируйся на общие \
требования тендерной практики: технические характеристики, комплектность, \
сроки и условия поставки, гарантии, документация, порядок приёмки.""",
}


def _domain_hint(context: TZCreationContext | None) -> str:
    domain = (context or {}).get("domain") or "other"
    return _DOMAIN_HINTS.get(domain, _DOMAIN_HINTS["other"])


def _context_summary(context: TZCreationContext | None) -> str:
    if not context:
        return ""
    domain = context.get("domain")
    note = (context.get("note") or "").strip()
    parts = []
    if domain:
        parts.append(f"тип закупки: {_DOMAIN_LABELS.get(domain, domain)}")
    if note:
        parts.append(f"дополнительный контекст от пользователя: {note}")
    return "; ".join(parts)


_RESPONSE_CONTRACT = """\
Верни ТОЛЬКО JSON без markdown-обёрток, строго такой формы:
{
  "assistant_message": "текст ответа пользователю на русском языке",
  "hierarchy_patch": {
    "1": {"text": "Название раздела", "children": {
      "1.1": {"text": "Формулировка требования", "children": {}}
    }}
  },
  "fields_update": [
    {"key": "capacity", "label": "Производительность", "value": "уточнить у пользователя", "status": "pending"}
  ],
  "suggested_done": false
}

Правила заполнения:
1. "hierarchy_patch" — ТОЛЬКО новые или изменённые узлы дерева ТЗ (не \
повторяй узлы, которые не менялись). Ключи — номера пунктов в формате \
"1", "1.1", "1.2.1" и т.п., родительский узел должен существовать в \
дереве или в этом же патче. Каждый узел — {"text": str, "children": {}}
2. "fields_update" — параметры, которые нужно показать пользователю в \
боковой панели: ключ (латиницей, без пробелов), понятная подпись на \
русском, текущее значение (или пустая строка/предположение), статус \
"pending" (ещё не уточнено), "suggested" (предложено ИИ, ждёт \
подтверждения) или "answered" (пользователь подтвердил значение)
3. "suggested_done": true — только когда структура ТЗ достаточно полна и \
не осталось критичных уточняющих вопросов
4. Пиши по-деловому, без эмодзи и маркетинговых оборотов
5. Не выдумывай технические характеристики от имени пользователя — \
предлагай варианты и явно проси подтверждения"""


def build_tz_kickoff_prompt(
    user_idea: str,
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for the "from scratch" scenario: turn an abstract idea into a
    draft outline plus clarifying parameters."""
    domain_hint = _domain_hint(context)
    context_summary = _context_summary(context)

    system = f"""\
Ты — эксперт по составлению технических заданий (ТЗ) для тендерных закупок.
Пользователь описал абстрактную идею закупки. Твоя задача — предложить \
черновую иерархическую структуру ТЗ (разделы и подпункты, пронумерованные \
"1", "1.1", "1.2" и т.д.) и список параметров, которые нужно уточнить у \
пользователя, чтобы наполнить разделы конкретикой.

{domain_hint}

Общие требования к структуре ТЗ (адаптируй под предметную область):
1. Общие требования / предмет закупки
2. Технические характеристики
3. Комплектность / требования к материалам
4. Условия поставки, монтажа, сроки
5. Гарантийные обязательства и сервис
6. Требования к документации и сертификации

{_RESPONSE_CONTRACT}

На этом шаге "suggested_done" всегда false — структура ещё черновая."""

    context_line = (
        f"\nКонтекст закупки: {context_summary}." if context_summary else ""
    )
    user = f"Идея пользователя для будущего ТЗ:\n{user_idea}{context_line}"
    return system, user


def build_tz_gap_analysis_prompt(
    hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for the "refine existing" scenario: analyze an already
    extracted TZ hierarchy for gaps, risks and open questions."""
    domain_hint = _domain_hint(context)
    context_summary = _context_summary(context)
    hierarchy_json = json.dumps(hierarchy, ensure_ascii=False, indent=2)

    system = f"""\
Ты — эксперт по составлению и проверке технических заданий (ТЗ) для \
тендерных закупок. Пользователь загрузил существующее ТЗ; ниже его \
извлечённая структура. Найди пробелы, потенциальные риски и \
неоднозначности с учётом предметной области, и предложи, что стоит \
добавить или уточнить.

{domain_hint}

Что нужно вернуть в "assistant_message":
1. Короткое резюме найденных пробелов и рисков (2-5 пунктов)
2. Явные уточняющие вопросы к пользователю по самым важным пробелам

{_RESPONSE_CONTRACT}

На этом шаге чаще всего "hierarchy_patch" пустой ({{}}) — ты не переписываешь \
загруженное ТЗ без запроса пользователя, только предлагаешь дополнения через \
вопросы и "fields_update". "suggested_done" — false."""

    context_line = (
        f"\nКонтекст закупки: {context_summary}." if context_summary else ""
    )
    user = (
        f"Извлечённая структура загруженного ТЗ:\n{hierarchy_json}"
        f"{context_line}"
    )
    return system, user


def build_tz_creation_turn_prompt(
    draft_hierarchy: dict[str, RequirementNode],
    fields: list[dict[str, str]],
    user_message: str,
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for every follow-up chat turn in both scenarios.

    The current draft state (hierarchy + fields) is always re-sent in
    full so the model's patches stay grounded, independently of how much
    prior chat history is included via ``LLMClient.complete(history=...)``.
    """
    domain_hint = _domain_hint(context)
    context_summary = _context_summary(context)
    hierarchy_json = json.dumps(draft_hierarchy, ensure_ascii=False, indent=2)
    fields_json = json.dumps(fields, ensure_ascii=False, indent=2)

    system = f"""\
Ты — эксперт по составлению технических заданий (ТЗ) для тендерных закупок, \
ведёшь диалог с пользователем, помогая пошагово наполнить и уточнить ТЗ.

{domain_hint}

На каждом шаге:
1. Учитывай последнее сообщение пользователя и текущее состояние черновика
2. Если пользователь дал конкретную информацию — отрази её в \
"hierarchy_patch" (добавь/уточни соответствующий пункт) и переведи \
связанный параметр в "fields_update" со статусом "answered"
3. Если информации не хватает — задай ОДИН уточняющий вопрос за раз в \
"assistant_message", не заваливай пользователя списком вопросов
4. Обращай внимание на подводные камни предметной области (см. выше) и \
предупреждай о них, если пользователь их не учёл

{_RESPONSE_CONTRACT}"""

    context_line = (
        f"\nКонтекст закупки: {context_summary}." if context_summary else ""
    )
    user = f"""\
Текущая структура ТЗ:
{hierarchy_json}

Текущие параметры:
{fields_json}
{context_line}

Новое сообщение пользователя:
{user_message}"""
    return system, user
