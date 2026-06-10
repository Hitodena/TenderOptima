"""Split long document text into LLM-sized chunks."""

from __future__ import annotations

import re


def clean_text(text: str) -> str:
    """Minimal cleanup before chunking and LLM extraction."""
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(ch if ch >= " " or ch in "\n\t" else " " for ch in text)

    lines = [" ".join(line.split()) for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _hard_split(text: str, max_chars: int) -> list[str]:
    """Split *text* into fixed-size pieces when no softer boundary fits."""
    return [text[i : i + max_chars] for i in range(0, len(text), max_chars)]


def _split_long_block(block: str, max_chars: int) -> list[str]:
    """Split an oversized paragraph or line into chunks ≤ *max_chars*."""
    if len(block) <= max_chars:
        return [block]

    parts: list[str] = []
    for line in block.split("\n"):
        if len(line) <= max_chars:
            parts.append(line)
            continue
        parts.extend(_hard_split(line, max_chars))
    return _pack_segments(parts, max_chars, separator="\n")


def _pack_segments(
    segments: list[str],
    max_chars: int,
    *,
    separator: str,
) -> list[str]:
    """Greedy-pack *segments* into chunks bounded by *max_chars*."""
    if not segments:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    sep_len = len(separator)

    for segment in segments:
        if not segment:
            continue
        extra = sep_len if current else 0
        if current_len + extra + len(segment) > max_chars:
            chunks.append(separator.join(current))
            current = [segment]
            current_len = len(segment)
            continue
        if current:
            current_len += sep_len
        current.append(segment)
        current_len += len(segment)

    if current:
        chunks.append(separator.join(current))
    return chunks


def _paragraph_segments(text: str, max_chars: int) -> list[str]:
    """Split *text* by paragraph boundaries."""
    segments: list[str] = []
    for paragraph in text.split("\n\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if len(paragraph) > max_chars:
            segments.extend(_split_long_block(paragraph, max_chars))
        else:
            segments.append(paragraph)
    return segments


def chunk_text(text: str, max_chars: int = 3200) -> list[str]:
    """Split *text* into chunks of at most *max_chars* characters.

    Prefer paragraph boundaries, then lines, and finally hard splits
    for very long lines.
    """
    text = clean_text(text)
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    segments = _paragraph_segments(text, max_chars)
    if not segments:
        return []

    return _pack_segments(segments, max_chars, separator="\n\n")
