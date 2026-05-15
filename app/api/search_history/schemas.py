import uuid
from datetime import datetime

from pydantic import BaseModel


class SearchHistoryRead(BaseModel):
    id: uuid.UUID
    query: str
    results_count: int | None
    request_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
