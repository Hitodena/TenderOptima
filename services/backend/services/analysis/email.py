from pathlib import Path

from loguru import logger

from backend.schemas.analysis import EmailAnalysisResult
from backend.services.extraction.assembler import TextAssembler
from backend.services.extraction.router import (
    ExtractorRouter,
    UnsupportedFileTypeError,
)
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.email import build_email_prompt
from backend.utils.ocr import OcrNotAvailableError

_router = ExtractorRouter()
_assembler = TextAssembler()


def _extract_attachment_text(path: Path) -> str | None:
    """Extract text from an email attachment; OCR for images when needed."""
    if not path.is_file():
        logger.warning("Email attachment missing on disk", path=str(path))
        return None

    try:
        doc = _router.get(path).extract(path)
    except UnsupportedFileTypeError:
        logger.warning(
            "Unsupported email attachment type",
            path=str(path),
            suffix=path.suffix.lower(),
        )
        return None
    except OcrNotAvailableError as exc:
        logger.warning(
            "OCR unavailable for email attachment",
            path=str(path),
            error=str(exc),
        )
        return None
    except Exception as exc:
        logger.warning(
            "Email attachment extraction failed",
            path=str(path),
            error=str(exc),
        )
        return None

    text = _assembler.assemble(doc).strip()
    if not text:
        logger.info(
            "Email attachment produced empty text",
            path=str(path),
        )
    return text or None


async def analyze_email(
    user_requirements: str,
    email_body: str,
    attachment_paths: list[Path] | None = None,
    baseline_matches: dict[str, str] | None = None,
) -> EmailAnalysisResult:
    parts: list[str] = []
    if email_body.strip():
        parts.append(email_body.strip())

    for path in attachment_paths or []:
        text = _extract_attachment_text(path)
        if text:
            display_name = path.name
            if "_" in display_name:
                prefix, rest = display_name.split("_", 1)
                if len(prefix) == 32 and all(
                    ch in "0123456789abcdefABCDEF" for ch in prefix
                ):
                    display_name = rest
            parts.append(f"[Вложение: {display_name}]\n{text}")

    full_text = "\n\n".join(parts)
    system, user = build_email_prompt(
        user_requirements,
        full_text,
        baseline_matches=baseline_matches,
    )
    raw = await llm_client.complete(system, user)

    return EmailAnalysisResult(**raw)
