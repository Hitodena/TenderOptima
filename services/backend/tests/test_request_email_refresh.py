"""Going back from the letter to the parameters and forward again."""

from __future__ import annotations

from types import SimpleNamespace

from backend.utils.email_utils import (
    build_request_email_body,
    refresh_request_email_body,
)

SIGNATURE = "ООО «Ромашка», Иванов И.И., +375 29 000-00-00"


def request(params, description="Поставка насосов", message=None):
    return SimpleNamespace(
        additional_params=params,
        description=description,
        email_message=message,
    )


USER = SimpleNamespace(business_info=SIGNATURE)


def first_letter(params, description="Поставка насосов") -> str:
    return build_request_email_body(request(params, description), USER)


def test_new_parameters_reach_the_letter() -> None:
    text = first_letter(["Цена с НДС"])
    refreshed, inserted = refresh_request_email_body(
        text,
        request(["Цена с НДС", "Цена без НДС", "Сервисная поддержка"]),
        USER,
    )
    assert (
        "1. Цена с НДС\n2. Цена без НДС\n3. Сервисная поддержка" in refreshed
    )
    assert not inserted


def test_the_user_s_own_wording_is_kept() -> None:
    text = first_letter(["Цена с НДС"]).replace(
        "Добрый день.", "Здравствуйте, коллеги! Просим ответить до пятницы."
    )
    text += "\nP.S. Звоните в любое время."
    refreshed, _ = refresh_request_email_body(
        text, request(["Срок поставки"]), USER
    )
    assert refreshed.startswith("Здравствуйте, коллеги! Просим ответить")
    assert refreshed.endswith("P.S. Звоните в любое время.")
    assert "1. Срок поставки" in refreshed
    assert "Цена с НДС" not in refreshed


def test_removed_parameters_leave_the_letter() -> None:
    text = first_letter(["Цена с НДС", "Цена без НДС"])
    refreshed, _ = refresh_request_email_body(text, request([]), USER)
    assert "Цена" not in refreshed
    assert refreshed.count("-------------------------------------") == 2


def test_a_changed_description_reaches_the_letter() -> None:
    text = first_letter(["Цена"], description="Насосы")
    refreshed, _ = refresh_request_email_body(
        text, request(["Цена"], description="Насосы и электродвигатели"), USER
    )
    assert "предложения на:\n\nНасосы и электродвигатели\n\n!" in refreshed


def test_section_is_put_back_before_the_signature_when_rules_were_removed() -> (
    None
):
    text = f"Добрый день. Нужны насосы.\n\n{SIGNATURE}"
    refreshed, inserted = refresh_request_email_body(
        text, request(["Цена с НДС"]), USER
    )
    assert inserted
    assert refreshed.index("1. Цена с НДС") < refreshed.index(SIGNATURE)
    assert refreshed.startswith("Добрый день. Нужны насосы.")


def test_section_goes_to_the_end_without_a_signature() -> None:
    refreshed, inserted = refresh_request_email_body(
        "Свой текст без реквизитов", request(["Цена"]), USER
    )
    assert inserted
    assert refreshed.startswith("Свой текст без реквизитов")
    assert refreshed.endswith("1. Цена\n-------------------------------------")


def test_nothing_is_added_when_there_are_no_parameters() -> None:
    refreshed, inserted = refresh_request_email_body(
        "Свой текст", request([]), USER
    )
    assert (refreshed, inserted) == ("Свой текст", False)


def test_refreshing_twice_changes_nothing_more() -> None:
    req = request(["Цена с НДС", "Срок"])
    once, _ = refresh_request_email_body(first_letter(["Цена"]), req, USER)
    twice, _ = refresh_request_email_body(once, req, USER)
    assert once == twice
