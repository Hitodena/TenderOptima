from pathlib import Path

from backend.schemas.analysis import (
    TZAnalysisResult,
    TZAnalysisSessionResult,
    compute_tz_stats,
)
from backend.services.extraction.assembler import TextAssembler
from backend.services.extraction.router import ExtractorRouter
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.tz import build_tz_prompt

_router = ExtractorRouter()
_assembler = TextAssembler()


async def analyze_tz_files(
    tz_path: Path, kp_path: Path
) -> TZAnalysisSessionResult:
    tz_text = _assembler.assemble(_router.get(tz_path).extract(tz_path))
    kp_text = _assembler.assemble(_router.get(kp_path).extract(kp_path))

    system, user = build_tz_prompt(tz_text, kp_text)
    raw = await llm_client.complete(system, user)
    result = TZAnalysisResult(**raw)
    stats = compute_tz_stats(result.items)

    return TZAnalysisSessionResult(
        tz_filename=tz_path.name,
        kp_filename=kp_path.name,
        items=result.items,
        match_score=stats["match_score"],
        met_count=stats["met_count"],
        partial_count=stats["partial_count"],
        missing_count=stats["missing_count"],
        not_found_count=stats["not_found_count"],
    )
