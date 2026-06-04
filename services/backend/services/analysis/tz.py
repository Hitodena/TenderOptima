from pathlib import Path

from backend.schemas.analysis import (
    TZAnalysisItem,
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


async def _analyze_single_kp(
    tz_text: str,
    kp_path: Path,
    kp_display_name: str,
) -> list[TZAnalysisItem]:
    kp_text = _assembler.assemble(_router.get(kp_path).extract(kp_path))
    system, user = build_tz_prompt(tz_text, kp_text)
    raw = await llm_client.complete(system, user)
    result = TZAnalysisResult(**raw)
    items: list[TZAnalysisItem] = []
    for item in result.items:
        items.append(item.model_copy(update={"kp_name": kp_display_name}))
    return items


async def analyze_tz_files(
    tz_path: Path,
    kp_paths: list[Path],
    *,
    kp_display_names: list[str] | None = None,
) -> TZAnalysisSessionResult:
    if not kp_paths:
        raise ValueError("At least one KP file is required")

    names = kp_display_names or [p.name for p in kp_paths]
    if len(names) != len(kp_paths):
        names = [p.name for p in kp_paths]

    tz_text = _assembler.assemble(_router.get(tz_path).extract(tz_path))

    all_items: list[TZAnalysisItem] = []
    for kp_path, kp_name in zip(kp_paths, names, strict=True):
        all_items.extend(await _analyze_single_kp(tz_text, kp_path, kp_name))

    stats = compute_tz_stats(all_items)
    primary_kp = names[0] if len(names) == 1 else None

    return TZAnalysisSessionResult(
        tz_filename=tz_path.name,
        kp_filename=primary_kp,
        kp_filenames=names,
        items=all_items,
        match_score=stats["match_score"],
        met_count=stats["met_count"],
        partial_count=stats["partial_count"],
        missing_count=stats["missing_count"],
        not_found_count=stats["not_found_count"],
    )
