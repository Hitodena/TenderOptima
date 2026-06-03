from abc import ABC, abstractmethod
from pathlib import Path

from backend.schemas.extracted_document import ExtractedDocument


class BaseExtractor(ABC):
    @classmethod
    @abstractmethod
    def extract(cls, file_path: Path) -> ExtractedDocument: ...
