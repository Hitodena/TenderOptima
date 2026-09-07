"""Unit tests for RFQ preference footer text."""

from backend.utils.email_preference_footer import (
    SUBSCRIBE_LABEL,
    UNSUBSCRIBE_LABEL,
    append_plain_footer,
    build_html_body,
)


def test_plain_footer_includes_both_links():
    text = append_plain_footer(
        "Добрый день.",
        subscribe_url="https://app.example/cooperation?token=a",
        unsubscribe_url="https://app.example/s/unsubscribe?token=b",
    )
    assert SUBSCRIBE_LABEL in text
    assert "https://app.example/cooperation?token=a" in text
    assert UNSUBSCRIBE_LABEL in text
    assert "https://app.example/s/unsubscribe?token=b" in text


def test_plain_footer_hides_subscribe_for_confirmed():
    text = append_plain_footer(
        "Добрый день.",
        subscribe_url=None,
        unsubscribe_url="https://app.example/s/unsubscribe?token=b",
    )
    assert SUBSCRIBE_LABEL not in text
    assert UNSUBSCRIBE_LABEL in text


def test_html_footer_styles_links():
    html = build_html_body(
        "Строка\nвторая",
        subscribe_url="https://app.example/cooperation?token=a",
        unsubscribe_url="https://app.example/s/unsubscribe?token=b",
    )
    assert SUBSCRIBE_LABEL in html
    assert UNSUBSCRIBE_LABEL in html
    assert "font-weight:600" in html
    assert "#9ca3af" in html
    assert "<br>" in html
