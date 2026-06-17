from pathlib import Path

from backend.schemas.analysis import EmailAnalysisResult
from backend.services.extraction.assembler import TextAssembler
from backend.services.extraction.router import ExtractorRouter
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.email import build_email_prompt

_router = ExtractorRouter()
_assembler = TextAssembler()


async def analyze_email(
    user_requirements: str,
    email_body: str,
    attachment_paths: list[Path] | None = None,
    baseline_matches: dict[str, str] | None = None,
) -> EmailAnalysisResult:
    parts: list[str] = []
    parts.append(email_body)

    for path in attachment_paths or []:
        doc = _router.get(path).extract(path)
        text = _assembler.assemble(doc)
        if text.strip():
            parts.append(f"[Вложение: {path.name}]\n{text.strip()}")

    full_text = "\n\n".join(parts)
    system, user = build_email_prompt(
        user_requirements,
        full_text,
        baseline_matches=baseline_matches,
    )
    raw = await llm_client.complete(system, user)

    return EmailAnalysisResult(**raw)
