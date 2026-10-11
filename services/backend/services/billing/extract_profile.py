"""Extract billing profile fields from uploaded documents and free text."""

from pathlib import Path

from backend.services.extraction.assembler import TextAssembler
from backend.services.extraction.router import ExtractorRouter
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.billing import (
    BillingProfileExtractResult,
    build_billing_profile_extract_prompt,
)

SUPPORTED_BILLING_PROFILE_EXTENSIONS = frozenset(
    {".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".txt"}
)

_router = ExtractorRouter()
_assembler = TextAssembler()


def is_supported_billing_profile_file(filename: str) -> bool:
    """Whether a billing-profile upload has a supported file extension."""
    return (
        Path(filename).suffix.lower() in SUPPORTED_BILLING_PROFILE_EXTENSIONS
    )


async def extract_billing_profile_fields(
    *,
    free_text: str = "",
    file_paths: list[Path] | None = None,
) -> BillingProfileExtractResult:
    parts: list[str] = []
    if free_text.strip():
        parts.append(free_text.strip())
    for path in file_paths or []:
        if not path.is_file():
            continue
        try:
            extracted = _router.get(path).extract(path)
            text = _assembler.assemble(extracted)
            if text.strip():
                parts.append(text.strip())
        except Exception:
            continue
    if not parts:
        return BillingProfileExtractResult()
    source = "\n\n---\n\n".join(parts)
    system, user = build_billing_profile_extract_prompt(source)
    raw = await llm_client.complete(system, user)
    return BillingProfileExtractResult(**raw)
