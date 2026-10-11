"""Shared helpers for tz_structure tests."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

from backend.services.tz_structure.model import DocModel, Paragraph, Table

ORACLE_SCRIPT = Path(__file__).with_name("word_oracle.ps1")


def flat_paragraphs(model: DocModel) -> list[Paragraph]:
    """All paragraphs in reading order, including table cells."""
    result: list[Paragraph] = []
    for block in model.blocks:
        if isinstance(block, Table):
            for row in block.rows:
                for cell in row.cells:
                    result.extend(cell.paragraphs)
        else:
            result.append(block)
    return result


def visible_labels(model: DocModel) -> list[str]:
    """Label of every paragraph that shows text or a number."""
    return [
        paragraph.label.raw if paragraph.label else ""
        for paragraph in flat_paragraphs(model)
        if paragraph.text or paragraph.label
    ]


def word_oracle_enabled() -> bool:
    return os.environ.get("TZ_WORD_ORACLE") == "1"


def ask_word(paths: list[Path]) -> dict[str, list[dict]]:
    """Run Microsoft Word over *paths* and return its paragraph data."""
    with tempfile.TemporaryDirectory() as tmp:
        list_file = Path(tmp) / "files.txt"
        out_file = Path(tmp) / "out.json"
        list_file.write_text(
            "\n".join(str(path.resolve()) for path in paths),
            encoding="utf-8-sig",
        )
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(ORACLE_SCRIPT),
                "-ListFile",
                str(list_file),
                "-OutFile",
                str(out_file),
            ],
            check=True,
            timeout=600,
        )
        raw = json.loads(out_file.read_text(encoding="utf-8"))
    return {str(Path(key)): value for key, value in raw.items()}


def word_visible(items: list[dict]) -> list[tuple[str, str]]:
    """(list string, text) for paragraphs Word shows text or a number in."""
    result: list[tuple[str, str]] = []
    for item in items:
        text = " ".join(
            item["text"].replace("\r", " ").replace("\x07", " ").split()
        )
        label = item["list"].strip()
        if text or label:
            result.append((label, text))
    return result
