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
    items: list[TZAnalysisItem]
    match_score: int
    met_count: int
    partial_count: int
    missing_count: int
    not_found_count: int
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
