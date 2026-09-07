"""Footer links and HTML wrapper for outbound RFQ emails."""

import html
from urllib.parse import quote
from uuid import UUID

from backend.core.config import get_config
from backend.enums import SupplierPreferenceTokenPurpose
from backend.utils.supplier_preference_tokens import create_preference_token

SUBSCRIBE_LABEL = "Получать похожие запросы"
UNSUBSCRIBE_LABEL = "Больше не присылать"


def build_preference_urls(
    email: str,
    *,
    request_id: UUID | None = None,
) -> tuple[str, str, str]:
    """Return (subscribe_page, unsubscribe_page, one_click_api) URLs."""
    config = get_config()
    frontend = config.frontend_base_url.rstrip("/")
    api = config.api_public_base_url.rstrip("/")
    subscribe_token = create_preference_token(
        email,
        SupplierPreferenceTokenPurpose.SUBSCRIBE,
        request_id=request_id,
    )
    unsubscribe_token = create_preference_token(
        email,
        SupplierPreferenceTokenPurpose.UNSUBSCRIBE,
        request_id=request_id,
    )
    subscribe_url = f"{frontend}/cooperation?token={quote(subscribe_token)}"
    unsubscribe_url = (
        f"{frontend}/s/unsubscribe?token={quote(unsubscribe_token)}"
    )
    one_click_url = (
        f"{api}/api/supplier-preferences/one-click"
        f"?token={quote(unsubscribe_token)}"
    )
    return subscribe_url, unsubscribe_url, one_click_url


def append_plain_footer(
    body: str,
    *,
    subscribe_url: str | None,
    unsubscribe_url: str,
) -> str:
    """Append a plain-text preference footer to the RFQ body."""
    lines = ["", "---"]
    if subscribe_url:
        lines.append(f"{SUBSCRIBE_LABEL}: {subscribe_url}")
    lines.append(f"{UNSUBSCRIBE_LABEL}: {unsubscribe_url}")
    return body.rstrip() + "\n" + "\n".join(lines) + "\n"


def build_html_body(
    body: str,
    *,
    subscribe_url: str | None,
    unsubscribe_url: str,
) -> str:
    """HTML alternative: escaped body plus styled footer links."""
    escaped = html.escape(body).replace("\n", "<br>\n")
    links: list[str] = []
    if subscribe_url:
        links.append(
            f'<a href="{html.escape(subscribe_url, quote=True)}" style="color:#2563eb;font-weight:600;'
            f'text-decoration:underline;">{html.escape(SUBSCRIBE_LABEL)}</a>'
        )
    links.append(
        f'<a href="{html.escape(unsubscribe_url, quote=True)}" style="color:#9ca3af;text-decoration:underline;">'
        f"{html.escape(UNSUBSCRIBE_LABEL)}</a>"
    )
    footer = (
        '<div style="margin-top:24px;padding-top:16px;'
        'border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;">'
        + " &nbsp;·&nbsp; ".join(links)
        + "</div>"
    )
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;'
        'font-size:14px;line-height:1.5;color:#111827;">'
        f"{escaped}{footer}</div>"
    )
