from pathlib import Path

from pydantic import BaseModel

from backend.schemas.analysis import (
    TZAnalysisItem,
    TZAnalysisResult,
    TZAnalysisSessionResult,
    build_analysis_stats,
)
from backend.services.extraction.assembler import TextAssembler
from backend.services.extraction.router import ExtractorRouter
from backend.services.llm.client import llm_client
from backend.services.llm.prompts.tz import (
    build_comparison_prompt,
    build_kp_extract_prompt,
    build_tz_extract_prompt,
)

_router = ExtractorRouter()
_assembler = TextAssembler()


class TZExtractResult(BaseModel):
    requirements: list[str]


class KPExtractResult(BaseModel):
    offerings: list[str]


async def extract_tz_requirements(tz_text: str) -> list[str]:
    system, user = build_tz_extract_prompt(tz_text)
    raw = await llm_client.complete(system, user)
    result = TZExtractResult(**raw)
    return result.requirements


async def extract_kp_requirements(kp_text: str) -> list[str]:
    system, user = build_kp_extract_prompt(kp_text)
    raw = await llm_client.complete(system, user)
    result = KPExtractResult(**raw)
    return result.offerings


async def _compare_single_kp(
    requirements_tz: list[str],
    kp_name: str,
    kp_offerings: list[str],
) -> list[TZAnalysisItem]:
    system, user = build_comparison_prompt(requirements_tz, kp_name, kp_offerings)
    raw = await llm_client.complete(system, user)
    result = TZAnalysisResult(**raw)
    items: list[TZAnalysisItem] = []
    for item in result.items:
        items.append(item.model_copy(update={"kp_name": kp_name}))
    return items


async def compare_requirements(
    requirements_tz: list[str],
    requirements_kp: dict[str, list[str]],
) -> list[TZAnalysisItem]:
    all_items: list[TZAnalysisItem] = []
    for kp_name, kp_offerings in requirements_kp.items():
        all_items.extend(
            await _compare_single_kp(requirements_tz, kp_name, kp_offerings)
        )
    return all_items


async def compare_only(
    requirements_tz: list[str],
    requirements_kp: dict[str, list[str]],
) -> list[TZAnalysisItem]:
    return await compare_requirements(requirements_tz, requirements_kp)


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
    requirements_tz = await extract_tz_requirements(tz_text)

    requirements_kp: dict[str, list[str]] = {}
    for kp_path, kp_name in zip(kp_paths, names, strict=True):
        kp_text = _assembler.assemble(_router.get(kp_path).extract(kp_path))
        requirements_kp[kp_name] = await extract_kp_requirements(kp_text)

    all_items = await compare_requirements(requirements_tz, requirements_kp)
    kp_stats, primary_kp, top_stats = build_analysis_stats(all_items, names)

    return TZAnalysisSessionResult(
        tz_filename=tz_path.name,
        kp_filename=primary_kp,
        kp_filenames=names,
        requirements_tz=requirements_tz,
        requirements_kp=requirements_kp,
        kp_stats=kp_stats,
        items=all_items,
        match_score=top_stats["match_score"],
        met_count=top_stats["met_count"],
        partial_count=top_stats["partial_count"],
        missing_count=top_stats["missing_count"],
        not_found_count=top_stats["not_found_count"],
    )
