from pydantic import BaseModel, Field


class ExtractedDocument(BaseModel):
    text: str = Field(default="")
    tables: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
