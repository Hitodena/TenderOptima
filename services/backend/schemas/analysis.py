from pydantic import BaseModel

from backend.enums import TZAnalysisRunStatus, TZAnalysisStatus


class TZAnalysisItem(BaseModel):
    requirement: str
    requirement_ref: str | None = None
    offer_value: str | None = None
    offer_ref: str | None = None
    explanation: str
    status: TZAnalysisStatus
    kp_name: str | None = None


class TZAnalysisResult(BaseModel):
    items: list[TZAnalysisItem]


class TZAnalysisSessionResult(BaseModel):
    id: str | None = None
    title: str | None = None
    status: TZAnalysisRunStatus = TZAnalysisRunStatus.PROCESSING
    tz_filename: str | None = None
    kp_filename: str | None = None
    kp_filenames: list[str] = []
    confirmed: bool = False
    requirements_tz: dict = {}
    requirements_kp: dict[str, dict] = {}
    kp_stats: dict[str, dict[str, int]] = {}
    items: list[TZAnalysisItem]
    match_score: int
    met_count: int
    partial_count: int
    missing_count: int
    not_found_count: int
    tz_requirements_count: int = 0
    created_at: str | None = None


class RequirementMatch(BaseModel):
    requirement: str
    offer_value: str | None = None
    explanation: str | None = None
    status: TZAnalysisStatus


class EmailAnalysisResult(BaseModel):
    parameters: dict[str, str]
    matches: list[RequirementMatch]


def compute_tz_stats(items: list[TZAnalysisItem]) -> dict[str, int]:
    met = sum(1 for i in items if i.status == TZAnalysisStatus.MET)
    partial = sum(1 for i in items if i.status == TZAnalysisStatus.PARTIAL)
    missing = sum(1 for i in items if i.status == TZAnalysisStatus.MISSING)
    not_found = sum(1 for i in items if i.status == TZAnalysisStatus.NOT_FOUND)
    total = len(items)
    if total == 0:
        score = 0
    else:
        score = round((met + 0.5 * partial) / total * 100)
    return {
        "match_score": score,
        "met_count": met,
        "partial_count": partial,
        "missing_count": missing,
        "not_found_count": not_found,
    }


def compute_kp_stats(
    items: list[TZAnalysisItem],
    kp_filenames: list[str] | None = None,
) -> dict[str, dict[str, int]]:
    """Return match stats keyed by KP display name."""
    grouped: dict[str, list[TZAnalysisItem]] = {}
    for item in items:
        key = item.kp_name or "_default"
        grouped.setdefault(key, []).append(item)

    stats: dict[str, dict[str, int]] = {}
    for name in kp_filenames or []:
        stats[name] = compute_tz_stats(grouped.get(name, []))
    for key, group_items in grouped.items():
        if key not in stats:
            stats[key] = compute_tz_stats(group_items)
    return stats


def resolve_primary_kp(
    kp_filenames: list[str],
    current_primary: str | None = None,
) -> str | None:
    if not kp_filenames:
        return current_primary
    if current_primary and current_primary in kp_filenames:
        return current_primary
    return kp_filenames[0]


def primary_stats_fields(
    kp_stats: dict[str, dict[str, int]],
    primary_kp: str | None,
) -> dict[str, int]:
    """Top-level counters for the selected primary KP."""
    empty = {
        "match_score": 0,
        "met_count": 0,
        "partial_count": 0,
        "missing_count": 0,
        "not_found_count": 0,
    }
    if not primary_kp:
        return empty
    return {**empty, **(kp_stats.get(primary_kp) or {})}


def build_analysis_stats(
    items: list[TZAnalysisItem],
    kp_filenames: list[str],
    primary_kp: str | None = None,
) -> tuple[dict[str, dict[str, int]], str | None, dict[str, int]]:
    kp_stats = compute_kp_stats(items, kp_filenames)
    primary = resolve_primary_kp(kp_filenames, primary_kp)
    top = primary_stats_fields(kp_stats, primary)
    return kp_stats, primary, top
