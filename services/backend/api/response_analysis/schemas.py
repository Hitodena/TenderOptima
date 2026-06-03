from pydantic import BaseModel, Field

from backend.enums import TZAnalysisRunStatus
from backend.schemas.analysis import EmailAnalysisResult


class EmailAnalysisPatch(BaseModel):
    parameters: dict[str, str | None] = Field(default_factory=dict)


class EmailAnalysisResponse(EmailAnalysisResult):
    message_id: str
    status: TZAnalysisRunStatus = TZAnalysisRunStatus.ACTIVE
