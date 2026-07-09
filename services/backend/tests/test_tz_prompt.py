from backend.services.llm.prompts.tz import (
    _ATOMIC_REQUIREMENT_RULES,
    _NUMBERING_RULES,
    _tz_extraction_system_prompt,
)


def test_tz_prompt_splits_bullet_lists_under_heading():
    system = _tz_extraction_system_prompt()
    assert "Маркированные строки" in _NUMBERING_RULES
    assert "НЕ часть текста заголовка" in _NUMBERING_RULES
    assert "Технологические данные" in system
    assert "НЕ вставляй весь список в text заголовка" in system
    assert "Строки с «-» — часть текста родителя" not in _NUMBERING_RULES


def test_tz_prompt_atomic_split_for_long_obligation_lists():
    assert "Участник обязан" in _ATOMIC_REQUIREMENT_RULES
    assert "НЕ склеивай заголовок раздела" in _ATOMIC_REQUIREMENT_RULES
    assert (
        "Извлекай ВСЕ содержательные leaf-требования"
        in _ATOMIC_REQUIREMENT_RULES
    )
