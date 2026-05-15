import uuid
from datetime import datetime

from pydantic import BaseModel


class BlacklistCreate(BaseModel):
    domain: str
    reason: str | None = None


class BlacklistRead(BaseModel):
    id: uuid.UUID
    domain: str
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
