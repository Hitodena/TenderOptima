"""Prompts for the TZ creation wizard (Module 3).

Two entry scenarios feed the same iterative "turn" loop:

- ``refine_existing`` — an uploaded TZ is extracted with the existing
  Module 2 pipeline, then an intake turn asks what to improve; the first
  user reply triggers :func:`build_tz_gap_analysis_prompt`.
- ``from_scratch`` — an orienting-questions turn finds key anchor points;
  the first user reply triggers :func:`build_tz_kickoff_prompt`.

Every following turn (both scenarios) goes through
:func:`build_tz_creation_turn_prompt`, which always returns the same
JSON contract so the backend can apply it uniformly.
"""

import json

from backend.utils.requirements_struct import (
    RequirementNode,
    count_requirements,
)

TZCreationContext = dict[str, str | None]

_BASE_PROCUREMENT_HINT = """\
Ориентируйся на общие требования тендерной практики: технические \
характеристики, комплектность, сроки и условия поставки, гарантии, \
документация, порядок приёмки, нормативные требования (ГОСТ / ТР ТС / \
СанПиН — по предмету закупки), сертификаты и допуски. Если отрасль \
указана — уточни типичные для неё риски; если что-то неочевидно — \
спроси у пользователя, а не выдумывай."""


def _industry_hint(context: TZCreationContext | None) -> str:
    industry = ((context or {}).get("industry") or "").strip()
    if not industry:
        return (
            "Отрасль/направление закупки не указаны.\n"
            f"{_BASE_PROCUREMENT_HINT}"
        )
    return (
        f'Направление/отрасль закупки: "{industry}". Самостоятельно определи '
        "и учитывай характерные для неё нормативные требования "
        "(ГОСТ/ТР ТС/СанПиН), типовые технические параметры, необходимые "
        "сертификаты/допуски и типичные риски; если что-то неочевидно — "
        "спроси у пользователя, а не выдумывай.\n"
        f"{_BASE_PROCUREMENT_HINT}"
    )


def _context_summary(context: TZCreationContext | None) -> str:
    if not context:
        return ""
    industry = (context.get("industry") or "").strip()
    note = (context.get("note") or "").strip()
    parts = []
    if industry:
        parts.append(f"отрасль/направление: {industry}")
    if note:
        parts.append(f"дополнительный контекст от пользователя: {note}")
    return "; ".join(parts)


_UI_LAYOUT = """\
Интерфейс конструктора ТЗ, в котором работает пользователь:
- «Диалог с ИИ» — чат, куда ты пишешь "assistant_message"
- «Пункты ТЗ» — вкладка с деревом разделов и требований (обновляется через \
"hierarchy_patch")
- «Параметры ТЗ» — панель со списком ключевых полей закупки \
(обновляется через "fields_update") и блоком открытых вопросов \
("open_questions")

Когда нужно направить пользователя заполнить или проверить поля, ссылайся \
именно на панель «Параметры ТЗ». Не пиши «в списке ниже», «в боковой панели» \
или «внизу сообщения» — этих элементов в чате нет."""

_RESPONSE_CONTRACT = f"""\
Верни ТОЛЬКО JSON без markdown-обёрток, строго такой формы:
{{
  "assistant_message": "текст ответа пользователю на русском языке",
  "hierarchy_patch": {{
    "1": {{"text": "Название раздела", "children": {{
      "1.1": {{"text": "Формулировка требования", "children": {{}}}}
    }}}}
  }},
  "fields_update": [
    {{"key": "capacity", "label": "Производительность", "value": "уточнить у пользователя", "status": "pending", "requirement_key": "2.1"}}
  ],
  "open_questions": [
    "Какой объём закупки планируется?"
  ],
  "suggested_done": false
}}

{_UI_LAYOUT}

Правила заполнения:
1. "hierarchy_patch" — ТОЛЬКО новые или изменённые узлы дерева ТЗ (не \
повторяй узлы, которые не менялись). Ключи — номера пунктов в формате \
"1", "1.1", "1.2.1" и т.п., родительский узел должен существовать в \
дереве или в этом же патче. Каждый узел — {{"text": str, "children": {{}}}}
2. "fields_update" — параметры, которые нужно показать пользователю в \
панели «Параметры ТЗ»: ключ (латиницей, без пробелов), понятная \
подпись на русском, текущее значение или предложенный вариант, \
статус "pending" (ещё не уточнено), "suggested" (предложено ИИ, ждёт \
подтверждения галочкой пользователем) или "answered" (пользователь \
уже подтвердил). Если параметр относится к конкретному пункту структуры \
ТЗ, обязательно заполни "requirement_key" номером пункта (например "2.1"). \
Не пытайся управлять флагом подтверждения — его ставит только пользователь
3. "open_questions" — ПОЛНЫЙ актуальный список всё ещё открытых \
уточняющих вопросов (не привязанных к конкретному параметру). На каждом \
ходу заменяй список целиком: убери решённые, добавь новые. Пустой \
массив [], если открытых вопросов нет
4. "suggested_done": true — только когда структура ТЗ достаточно полна и \
не осталось критичных уточняющих вопросов
5. Пиши по-деловому, без эмодзи и маркетинговых оборотов
6. Не выдумывай технические характеристики от имени пользователя — \
предлагай варианты и явно проси подтверждения в панели «Параметры ТЗ»
7. В "assistant_message", если просишь уточнить параметры из \
"fields_update", формулируй так: «уточните параметры в панели \
«Параметры ТЗ»» (или аналогично с этим точным названием панели)"""


def build_tz_orienting_questions_prompt(
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """First assistant message for from_scratch: key anchor questions."""
    industry_hint = _industry_hint(context)
    context_summary = _context_summary(context)

    system = f"""\
Ты — эксперт по составлению технических заданий (ТЗ) для тендерных закупок.
Пользователь только что открыл конструктор ТЗ «с нуля». Твоя задача — \
задать 3–5 наводящих вопросов, которые найдут ключевые точки опоры для \
будущего ТЗ. Пока НЕ предлагай структуру ТЗ и НЕ заполняй параметры.

{industry_hint}

Наводящие вопросы должны покрывать (адаптируй формулировки):
1. Что именно закупается (предмет / услуга / продукт)
2. Масштаб / объём / производительность
3. Критичные ограничения (сроки, бюджет, место поставки, совместимость)
4. Обязательные нормативные требования или сертификация
5. Что для заказчика особенно важно / риски, которых нельзя допустить

Верни ТОЛЬКО JSON без markdown-обёрток:
{{
  "assistant_message": "приветствие + 3-5 нумерованных вопросов на русском"
}}

Правила:
1. Пиши по-деловому, без эмодзи и маркетинга
2. Не выдумывай ответы за пользователя
3. Если отрасль уже указана в контексте — учти её в формулировках; \
если нет — мягко предложи указать отрасль/направление в поле \
«Отрасль/направление» (например, «пищевая отрасль»)
4. В конце коротко скажи, что после ответа начнётся формирование структуры ТЗ"""

    context_line = (
        f"\nКонтекст закупки: {context_summary}." if context_summary else ""
    )
    user = (
        "Пользователь только что создал сессию конструктора ТЗ с нуля. "
        f"Задай наводящие вопросы.{context_line}"
    )
    return system, user


def build_tz_post_upload_intake_prompt(
    hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """First assistant message after refine_existing extract."""
    industry_hint = _industry_hint(context)
    context_summary = _context_summary(context)
    hierarchy_json = json.dumps(hierarchy, ensure_ascii=False, indent=2)
    req_count = count_requirements(hierarchy)
    section_count = len(hierarchy)

    system = f"""\
Ты — эксперт по составлению и проверке технических заданий (ТЗ).
Пользователь загрузил существующее ТЗ; оно уже извлечено в иерархию. \
Твоя задача на ЭТОМ шаге — коротко резюмировать, что удалось извлечь, \
и задать уточняющие вопросы. Пока НЕ делай полный gap-анализ и НЕ \
переписывай структуру.

{industry_hint}

Верни ТОЛЬКО JSON без markdown-обёрток:
{{
  "assistant_message": "резюме + вопросы на русском"
}}

В "assistant_message" обязательно:
1. Короткое резюме: сколько разделов верхнего уровня и пунктов требований \
нашлось (ориентир: ~{section_count} разделов, ~{req_count} пунктов)
2. Вопрос: что именно улучшить / на что обратить внимание (пробелы, \
риски, неоднозначности)
3. Если отрасль/направление ещё не указаны — предложи заполнить поле \
«Отрасль/направление» (по желанию)
4. Скажи, что после ответа начнётся анализ пробелов и подводных камней

Правила: по-деловому, без эмодзи, без выдуманных фактов."""

    context_line = (
        f"\nКонтекст закупки: {context_summary}." if context_summary else ""
    )
    user = (
        f"Извлечённая структура загруженного ТЗ:\n{hierarchy_json}"
        f"{context_line}"
    )
    return system, user


def build_tz_kickoff_prompt(
    user_idea: str,
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for the "from scratch" scenario: turn an abstract idea into a
    draft outline plus clarifying parameters."""
    industry_hint = _industry_hint(context)
    context_summary = _context_summary(context)

    system = f"""\
Ты — эксперт по составлению технических заданий (ТЗ) для тендерных закупок.
Пользователь ответил на наводящие вопросы / описал идею закупки. Твоя \
задача — предложить черновую иерархическую структуру ТЗ (разделы и \
подпункты, пронумерованные "1", "1.1", "1.2" и т.д.) и список параметров, \
которые нужно уточнить у пользователя, чтобы наполнить разделы конкретикой.

{industry_hint}

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
    user = f"Идея / ответы пользователя для будущего ТЗ:\n{user_idea}{context_line}"
    return system, user


def build_tz_gap_analysis_prompt(
    hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for the "refine existing" scenario: analyze an already
    extracted TZ hierarchy for gaps, risks and open questions."""
    industry_hint = _industry_hint(context)
    context_summary = _context_summary(context)
    hierarchy_json = json.dumps(hierarchy, ensure_ascii=False, indent=2)

    system = f"""\
Ты — эксперт по составлению и проверке технических заданий (ТЗ) для \
тендерных закупок. Пользователь загрузил существующее ТЗ; ниже его \
извлечённая структура. Учти, что он уже указал, что именно хочет \
улучшить (см. контекст / историю). Найди пробелы, потенциальные риски и \
неоднозначности с учётом предметной области, и предложи, что стоит \
добавить или уточнить.

{industry_hint}

Что нужно вернуть в "assistant_message":
1. Короткое резюме найденных пробелов и рисков (2-5 пунктов)
2. Явные уточняющие вопросы к пользователю по самым важным пробелам
3. Если заполняешь "fields_update" — попроси уточнить параметры в панели \
«Параметры ТЗ»

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
    fields: list[dict[str, str | None]],
    user_message: str,
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for every follow-up chat turn in both scenarios.

    The current draft state (hierarchy + fields) is always re-sent in
    full so the model's patches stay grounded, independently of how much
    prior chat history is included via ``LLMClient.complete(history=...)``.
    """
    industry_hint = _industry_hint(context)
    context_summary = _context_summary(context)
    hierarchy_json = json.dumps(draft_hierarchy, ensure_ascii=False, indent=2)
    fields_json = json.dumps(fields, ensure_ascii=False, indent=2)

    system = f"""\
Ты — эксперт по составлению технических заданий (ТЗ) для тендерных закупок, \
ведёшь диалог с пользователем, помогая пошагово наполнить и уточнить ТЗ.

{industry_hint}

На каждом шаге:
1. Учитывай последнее сообщение пользователя и текущее состояние черновика
2. Если пользователь дал конкретную информацию — отрази её в \
"hierarchy_patch" (добавь/уточни соответствующий пункт) и переведи \
связанный параметр в "fields_update" со статусом "suggested" (ждёт \
подтверждения галочкой) или "answered", если пользователь явно подтвердил
3. Если информации не хватает — задай ОДИН уточняющий вопрос за раз в \
"assistant_message", не заваливай пользователя списком вопросов; \
остальные держи в "open_questions"
4. Обращай внимание на подводные камни предметной области (см. выше) и \
предупреждай о них, если пользователь их не учёл
5. Когда нужно заполнить или проверить поля — направляй пользователя в \
панель «Параметры ТЗ», а не «в список ниже»

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


def build_requirement_hint_prompt(
    requirement_key: str,
    requirement_text: str,
    draft_hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for an on-demand tip about one TZ outline item."""
    industry_hint = _industry_hint(context)
    context_summary = _context_summary(context)
    hierarchy_json = json.dumps(draft_hierarchy, ensure_ascii=False, indent=2)

    system = f"""\
Ты — эксперт по составлению технических заданий (ТЗ) для тендерных закупок.
Пользователь запросил короткую подсказку по одному пункту структуры ТЗ.

{industry_hint}

Верни ТОЛЬКО JSON без markdown-обёрток:
{{
  "hint": "короткая деловая подсказка на русском"
}}

Правила:
1. Подсказка — 2-4 предложения, без эмодзи и маркетинга
2. Объясни, что стоит уточнить/проверить в этом пункте и почему
3. Не переписывай весь пункт — дай практический совет
4. Не выдумывай конкретные числа от имени пользователя"""

    context_line = (
        f"\nКонтекст закупки: {context_summary}." if context_summary else ""
    )
    user = f"""\
Номер пункта: {requirement_key}
Текст пункта: {requirement_text}

Текущая структура ТЗ:
{hierarchy_json}
{context_line}"""
    return system, user


def build_field_hint_prompt(
    field_key: str,
    field_label: str,
    field_value: str,
    requirement_text: str | None,
    draft_hierarchy: dict[str, RequirementNode],
    context: TZCreationContext | None = None,
) -> tuple[str, str]:
    """Prompt for an on-demand tip about one parameter in «Параметры ТЗ»."""
    industry_hint = _industry_hint(context)
    context_summary = _context_summary(context)
    hierarchy_json = json.dumps(draft_hierarchy, ensure_ascii=False, indent=2)

    system = f"""\
Ты — эксперт по составлению технических заданий (ТЗ) для тендерных закупок.
Пользователь запросил короткую подсказку по одному параметру в панели \
«Параметры ТЗ».

{industry_hint}

Верни ТОЛЬКО JSON без markdown-обёрток:
{{
  "hint": "короткая деловая подсказка на русском"
}}

Правила:
1. Подсказка — 2-4 предложения, без эмодзи и маркетинга
2. Объясни, какое значение обычно указывают для этого параметра и на что \
обратить внимание при его уточнении
3. Если текущее значение уже указано — оцени, достаточно ли оно конкретно, \
и что стоит уточнить или проверить
4. Не выдумывай точные числа и факты от имени пользователя — предлагай \
типичные диапазоны и ориентиры"""

    context_line = (
        f"\nКонтекст закупки: {context_summary}." if context_summary else ""
    )
    requirement_line = (
        f"\nСвязанный пункт структуры ТЗ: {requirement_text}"
        if requirement_text
        else ""
    )
    user = f"""\
Параметр: {field_label} (ключ: {field_key})
Текущее значение: {field_value or "не указано"}{requirement_line}

Текущая структура ТЗ:
{hierarchy_json}
{context_line}"""
    return system, user
