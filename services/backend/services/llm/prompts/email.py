import json


def build_email_prompt(
    user_requirements: str,
    email_text: str,
    existing_matches: dict[str, str] | None = None,
) -> tuple[str, str]:
    has_existing = bool(existing_matches)
    existing_block = ""
    if existing_matches:
        existing_json = json.dumps(existing_matches, ensure_ascii=False)
        existing_block = f"""
Уже известные значения по требованиям из предыдущих писем поставщика:
{existing_json}

Это накопленный контекст переписки. Анализируй ТОЛЬКО новое письмо ниже.
"""

    incremental_rules = ""
    if has_existing:
        incremental_rules = """
Правила для повторного анализа (есть предыдущие значения):
1. Требование НЕ упомянуто в новом письме, но есть значение в списке выше
   → сохрани offer_value без изменений, status = "met", explanation = null
   (молчание поставщика = прежнее предложение остаётся в силе)
2. Поставщик явно подтвердил без изменений («без изменений», «как ранее», «подтверждаем»)
   → сохрани offer_value, status = "met", explanation = null
3. Поставщик указал новое значение по требованию
   → обнови offer_value, status = "met" (или "partial" если условно/неполно)
4. Поставщик явно отказал, отозвал или противоречит прежнему значению
   → status = "missing" или "partial", обнови offer_value и поясни в explanation
5. НЕ ставь "not_found" и НЕ ставь "partial" только потому, что поле не упомянуто в новом письме
6. НЕ домысливай: если изменилась связанная величина (например цена за штуку),
   но итог по требованию не указан — сохрани прежний offer_value, status = "met"
"""

    first_letter_rules = ""
    if not has_existing:
        first_letter_rules = """
Правила для первого письма (предыдущих значений нет):
1. Поставщик явно указал данные → status = "met"
2. Указал частично или с оговорками → status = "partial"
3. Упомянул, но не закрыл требование → status = "missing"
4. Не упомянул вообще → status = "not_found", offer_value = null
"""

    system = f"""\
Ты — аналитик, который разбирает ответы поставщиков в тендерной переписке.

Требования пользователя (формулировки использовать дословно в поле requirement):
{user_requirements}
{existing_block}
{incremental_rules}{first_letter_rules}
Общие правила:
1. В "matches" — ровно одна запись на КАЖДОЕ требование из списка пользователя
2. Поле "requirement" — точная формулировка из списка требований
3. "offer_value" — конкретное предложение поставщика (число, текст, условие); без интерпретаций
4. "explanation" — только при status "partial" или "missing"; для "met" и "not_found" — null
5. Не пиши в explanation фразы вроде «сохранено из предыдущего» — это лишнее при status "met"
6. Поле "parameters" всегда возвращай как пустой объект {{}}

Статусы:
- "met"        — требование закрыто: явно указано в письме ИЛИ сохранено из предыдущих писем
- "partial"    — выполнено частично, условно или с оговорками
- "missing"    — поставщик ответил по теме, но не закрыл требование полностью
- "not_found"  — только если это первое письмо и требование не упомянуто (offer_value = null)

Верни ТОЛЬКО JSON без markdown-обёрток:
{{
  "parameters": {{}},
  "matches": [
    {{
      "requirement": "формулировка требования",
      "offer_value": "значение или null",
      "explanation": "пояснение или null",
      "status": "met|partial|missing|not_found"
    }}
  ]
}}"""

    user = f"### Новое письмо поставщика:\n{email_text}"
    return system, user
