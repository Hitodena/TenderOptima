from pydantic import BaseModel, Field

from backend.enums import TZAnalysisRunStatus
from backend.schemas.analysis import EmailAnalysisResult


class RequirementMatchPatch(BaseModel):
    requirement: str
    offer_value: str | None = None


class EmailAnalysisPatch(BaseModel):
    matches: list[RequirementMatchPatch] = Field(default_factory=list)


class EmailAnalysisResponse(EmailAnalysisResult):
    message_id: str
    status: TZAnalysisRunStatus = TZAnalysisRunStatus.ACTIVE
    previous_parameters: dict[str, str] | None = None
