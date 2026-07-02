import json

from backend.schemas.analysis import RequirementMatch


def build_email_prompt(
    user_requirements: str,
    email_text: str,
    baseline_matches: dict[str, str] | None = None,
    prior_matches: dict[str, RequirementMatch] | None = None,
) -> tuple[str, str]:
    has_prior = bool(prior_matches)
    baseline_block = ""
    if baseline_matches:
        baseline_json = json.dumps(baseline_matches, ensure_ascii=False)
        baseline_block = f"""
Изначальный ответ поставщика (первое письмо, только для справки об изменениях):
{baseline_json}
"""

    prior_block = ""
    if prior_matches:
        prior_payload = [
            {
                "requirement": match.requirement,
                "offer_value": match.offer_value,
                "numeric_value": match.numeric_value,
                "currency": match.currency,
                "status": match.status.value,
                "explanation": match.explanation,
            }
            for match in prior_matches.values()
        ]
        prior_json = json.dumps(prior_payload, ensure_ascii=False)
        prior_block = f"""
Накопленное состояние переписки (актуальные ответы поставщика из предыдущих писем):
{prior_json}

Если в новом письме тема НЕ упомянута — сохрани offer_value и status из этого состояния.
"""

    repeat_rules = ""
    if has_prior:
        repeat_rules = """
Правила для повторного анализа (есть предыдущие ответы поставщика):
1. База сравнения — ТРЕБОВАНИЯ ЗАКАЗЧИКА из списка выше (изначальное ТЗ)
2. Ищи в новом письме только ИЗМЕНЕНИЯ и НОВЫЕ данные по требованиям
3. Если требование не упомянуто в новом письме → сохрани offer_value и status \
из накопленного состояния (НЕ сбрасывай в null / not_found)
4. Если поставщик явно указал новое значение → offer_value из нового письма; \
пересчитай status относительно ТЗ
5. Если поставщик явно отказал или противоречит требованию → status = "missing" \
или "partial" с новым offer_value из письма
6. Молчание по теме ≠ отказ: не обнуляй ранее зафиксированные ответы
"""

    first_letter_rules = ""
    if not has_prior:
        first_letter_rules = """
Правила для первого письма (изначального ответа поставщика):
1. Сравнивай ответ поставщика с требованиями заказчика из изначального ТЗ
2. Поставщик явно указал данные → status = "met" (если закрывает требование ТЗ)
3. Указал частично или с оговорками → status = "partial"
4. Упомянул, но не закрыл требование → status = "missing"
5. Не упомянул вообще → status = "not_found", offer_value = null
"""

    if has_prior:
        offer_value_rule = (
            '3. "offer_value" — из нового письма; если тема не упомянута — '
            "из накопленного состояния"
        )
        not_found_rule = (
            '- "not_found"  — только если тема не упомянута в новом письме И '
            "ранее тоже не было ответа (offer_value = null)"
        )
    else:
        offer_value_rule = (
            '3. "offer_value" — конкретное предложение поставщика из '
            "анализируемого письма (число, текст, условие); "
            "без интерпретаций; только то, что явно есть в письме"
        )
        not_found_rule = (
            '- "not_found"  — в письме нет информации по требованию '
            "(offer_value = null)"
        )

    system = f"""\
Ты — аналитик, который разбирает ответы поставщиков в тендерной переписке.

Изначальное ТЗ заказчика (эталон для оценки соответствия; формулировки использовать дословно в поле requirement):
{user_requirements}
{baseline_block}{prior_block}
{repeat_rules}{first_letter_rules}
Общие правила:
1. В "matches" — ровно одна запись на КАЖДОЕ требование из списка заказчика
2. Поле "requirement" — точная формулировка из списка требований
{offer_value_rule}
4. "explanation" — только при status "partial" или "missing"; для "met" и "not_found" — null
5. Не пиши в explanation фразы вроде «сохранено из предыдущего» или «как в первом письме»
6. Поле "parameters" всегда возвращай как пустой объект {{}}
7. Для ценовых требований («Общая стоимость без НДС», «Общая стоимость с НДС», \
«Цена за единицу без НДС») дополнительно заполняй:
   - "numeric_value" — только число без валюты и текста (например 14 или 1250.5); \
если цены нет — null
   - "currency" — код или символ валюты, если явно указан (BYN, USD, ₽); иначе null
   - "offer_value" — человекочитаемый текст как в письме (например «14 рублей без НДС»)

Статусы (всегда относительно изначального ТЗ заказчика):
- "met"        — предложение закрывает требование ТЗ
- "partial"    — есть ответ, но частично, условно или с оговорками
- "missing"    — есть ответ по теме, но он не соответствует требованию ТЗ
{not_found_rule}

Верни ТОЛЬКО JSON без markdown-обёрток:
{{
  "parameters": {{}},
  "matches": [
    {{
      "requirement": "формулировка требования",
      "offer_value": "значение или null",
      "numeric_value": null,
      "currency": null,
      "explanation": "пояснение или null",
      "status": "met|partial|missing|not_found"
    }}
  ]
}}"""

    user = f"### Новое письмо поставщика:\n{email_text}"
    return system, user
