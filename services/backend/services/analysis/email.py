from pathlib import Path

from loguru import logger

from backend.core.config import get_config
from backend.enums import TZAnalysisStatus
from backend.schemas.analysis import EmailAnalysisResult, RequirementMatch
from backend.services.analysis.email_attachments import read_attachments
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.email import build_email_prompt
from backend.utils.email_content import split_quoted_reply
from backend.utils.price_reconcile import (
    reconcile_price_matches,
    stamp_source_message_ids,
)

config = get_config()

QUOTE_MARKER = (
    "[Цитата предыдущей переписки — это НЕ новый ответ поставщика, "
    "только контекст]"
)
QUOTE_MAX_CHARS = 3000


def _merge_email_with_prior(
    result: EmailAnalysisResult,
    prior_matches: dict[str, RequirementMatch],
) -> EmailAnalysisResult:
    """Carry forward prior offer values when the new email is silent on a topic."""
    if not prior_matches:
        return result

    merged: list[RequirementMatch] = []
    for match in result.matches:
        req = match.requirement.strip()
        prior = prior_matches.get(req)
        if prior is None:
            merged.append(match)
            continue

        has_new_value = bool(
            match.offer_value and str(match.offer_value).strip(),
        )
        silent_in_new_email = (
            match.status == TZAnalysisStatus.NOT_FOUND and not has_new_value
        )
        if silent_in_new_email and (
            prior.offer_value and str(prior.offer_value).strip()
        ):
            # Keep prior provenance (source_message_id / value_origin).
            merged.append(prior)
            continue
        if silent_in_new_email and prior.status != TZAnalysisStatus.NOT_FOUND:
            merged.append(prior)
            continue
        merged.append(match)

    return result.model_copy(update={"matches": merged})


async def analyze_email(
    user_requirements: str,
    email_body: str,
    attachment_paths: list[Path] | None = None,
    baseline_matches: dict[str, str] | None = None,
    prior_matches: dict[str, RequirementMatch] | None = None,
    source_message_id: str | None = None,
    request_context: str | None = None,
) -> EmailAnalysisResult:
    # the quote of earlier letters (our request, old offers) is context only:
    # its numbers must not become the supplier's answer
    split = split_quoted_reply(email_body)
    parts: list[str] = []
    if split.main.strip():
        parts.append(split.main.strip())

    unread: list[str] = []
    for item in read_attachments(attachment_paths or []):
        if item.text:
            parts.append(f"[Вложение: {item.name}]\n{item.text}")
        else:
            unread.append(f"{item.name} — {item.reason}")
            logger.info(
                "Email attachment not read",
                attachment=item.name,
                reason=item.reason,
            )

    answer_text = "\n\n".join(parts)
    full_text = answer_text
    if split.quoted.strip():
        full_text += (
            f"\n\n{QUOTE_MARKER}\n" + split.quoted.strip()[:QUOTE_MAX_CHARS]
        )
    system, user = build_email_prompt(
        user_requirements,
        full_text,
        baseline_matches=baseline_matches,
        prior_matches=prior_matches,
        request_context=request_context,
    )
    raw = await llm_client.complete(
        system,
        user,
        model=config.openai_model,
    )

    result = EmailAnalysisResult(**raw)
    if prior_matches:
        result = _merge_email_with_prior(result, prior_matches)
    result = reconcile_price_matches(result, answer_text)
    if source_message_id:
        result = stamp_source_message_ids(result, source_message_id)
    return result.model_copy(update={"unread_files": unread})
