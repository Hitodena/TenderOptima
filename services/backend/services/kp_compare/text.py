"""Text helpers for comparing a TZ with a commercial offer.

The offer arrives as one string with «--- Страница N ---» page marks. These
helpers tell which page an offset is on and find the quotes the model says it
copied from the offer, tolerating the case, whitespace and punctuation noise
of text extracted from PDF and Word files.
"""

from __future__ import annotations

import re
import unicodedata
from bisect import bisect_right
from collections import Counter
from dataclasses import dataclass, field

_PAGE_MARK_RE = re.compile(r"---\s*Страница\s+(\d+)\s*---", re.IGNORECASE)

# bullets and symbol-font glyphs that PDF text uses as list markers
_SPACE_LIKE = set("•·▪▫◦‣⁃●○■□►▶✓✔") | {"", "", ""}
_FOLD = {
    **dict.fromkeys(map(ord, "‐‑‒–—―−"), "-"),
    **dict.fromkeys(map(ord, "«»„“”‟″"), '"'),
    **dict.fromkeys(map(ord, "‘’‚‛′`"), "'"),
    ord("ё"): "е",
}
_ELLIPSIS_RE = re.compile(r"\s*(?:\.{3,}|…)\s*")
# dotted leaders in tables («Insulation : ...... 50 mm») and ellipses
_DOT_RUN_RE = re.compile(r"(?:\.\s?){3,}|…+")
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


class PageIndex:
    """Page number of an offset in a text with page marks."""

    def __init__(self, text: str) -> None:
        self._starts: list[int] = []
        self._numbers: list[int] = []
        for match in _PAGE_MARK_RE.finditer(text):
            self._starts.append(match.start())
            self._numbers.append(int(match.group(1)))

    @property
    def has_pages(self) -> bool:
        return bool(self._starts)

    def page_at(self, offset: int) -> int | None:
        """Page of *offset*; None before the first mark or without marks."""
        index = bisect_right(self._starts, offset) - 1
        return self._numbers[index] if index >= 0 else None

    def page_range(
        self, start: int, end: int
    ) -> tuple[int | None, int | None]:
        """First and last page of the span [start, end)."""
        return self.page_at(start), self.page_at(max(start, end - 1))


def strip_page_marks(text: str) -> str:
    """Text without the page marks (they mean nothing to the reader)."""
    return _PAGE_MARK_RE.sub(" ", text)


def _fold_char(ch: str) -> str:
    if ch in _SPACE_LIKE or ch.isspace():
        return " "
    category = unicodedata.category(ch)
    if category in {"Cc", "Cf", "Co", "Cs", "Zs", "Zl", "Zp"}:
        return " "
    folded = unicodedata.normalize("NFKC", ch).casefold()
    return folded.translate(_FOLD)


@dataclass(frozen=True)
class FoldedText:
    """Comparable form of a text with a map back to source offsets.

    ``text`` is lower-cased, with unified dashes and quotes and runs of
    whitespace collapsed to one space; ``origin[i]`` is the offset in the
    source of ``text[i]``.
    """

    text: str
    origin: list[int]
    _tokens: list[tuple[str, int, int]] = field(
        default_factory=list, compare=False, repr=False
    )
    _token_starts: list[int] = field(
        default_factory=list, compare=False, repr=False
    )

    def source_span(self, start: int, end: int) -> tuple[int, int]:
        """Source offsets of the folded span [start, end)."""
        if not self.origin:
            return 0, 0
        last = min(end, len(self.origin)) - 1
        return self.origin[start], self.origin[max(start, last)] + 1

    def tokens(self) -> list[tuple[str, int, int]]:
        """Words of the folded text with their folded spans (cached)."""
        if not self._tokens:
            self._tokens.extend(
                (m.group(0), m.start(), m.end())
                for m in _TOKEN_RE.finditer(self.text)
            )
            self._token_starts.extend(t[1] for t in self._tokens)
        return self._tokens

    def tokens_between(
        self, start: int, end: int
    ) -> list[tuple[str, int, int]]:
        """Words lying inside the folded span [start, end)."""
        tokens = self.tokens()
        first = bisect_right(self._token_starts, start - 1)
        last = bisect_right(self._token_starts, end)
        return [t for t in tokens[first:last] if t[2] <= end]


def fold(source: str) -> FoldedText:
    """Comparable form of *source* (see :class:`FoldedText`).

    Dotted leaders and ellipses count as a space, so a quote copied from a
    table row matches however many dots the row has.
    """
    dots = bytearray(len(source))
    for match in _DOT_RUN_RE.finditer(source):
        dots[match.start() : match.end()] = b"\x01" * (
            match.end() - match.start()
        )
    out: list[str] = []
    origin: list[int] = []
    pending_space = False
    for index, ch in enumerate(source):
        piece = " " if dots[index] else _fold_char(ch)
        for folded in piece:
            if folded == " ":
                pending_space = bool(out)
                continue
            if pending_space:
                out.append(" ")
                origin.append(index)
                pending_space = False
            out.append(folded)
            origin.append(index)
    return FoldedText("".join(out), origin)


def fold_plain(source: str) -> str:
    """Folded string only, for comparisons that need no offsets."""
    return fold(source).text


@dataclass(frozen=True)
class QuoteMatch:
    """Where a quote was found in the source text."""

    start: int
    end: int
    exact: bool


_MIN_PART = 12
_FUZZY_SHARE = 0.85
_MAX_ANCHOR_HITS = 300


def _quote_parts(quote: str) -> list[str]:
    parts = [
        fold_plain(part).strip(" .,;:-\"'")
        for part in _ELLIPSIS_RE.split(quote)
    ]
    return [part for part in parts if part]


def _find_exact(
    parts: list[str], haystack: FoldedText, start: int, end: int
) -> tuple[int, int] | None:
    cursor = start
    first = -1
    last = -1
    for part in parts:
        if len(part) < _MIN_PART and len(parts) > 1:
            continue
        position = haystack.text.find(part, cursor, end)
        if position < 0:
            return None
        if first < 0:
            first = position
        last = position + len(part)
        cursor = last
    if first < 0:
        return None
    return first, last


def _find_fuzzy(
    quote: str, haystack: FoldedText, start: int, end: int
) -> tuple[int, int] | None:
    """Best window whose words cover most of the quote's words."""
    words = [w for w in _TOKEN_RE.findall(fold_plain(quote)) if len(w) > 1]
    if len(words) < 4:
        return None
    wanted = Counter(words)
    tokens = haystack.tokens_between(start, end)
    if not tokens:
        return None
    # windows open around the quote's longest words, which are rare in text
    anchors = sorted(
        {(word, index) for index, word in enumerate(words)},
        key=lambda pair: (-len(pair[0]), pair[1]),
    )[:2]
    slack = max(2, len(words) // 4)
    span = len(words) + 2 * slack
    best: tuple[float, int, int] | None = None
    for anchor, offset in anchors:
        seen = 0
        for index, (word, _, _) in enumerate(tokens):
            if word != anchor:
                continue
            seen += 1
            if seen > _MAX_ANCHOR_HITS:
                break
            first = max(0, index - offset - slack)
            window = tokens[first : first + span]
            have = Counter(w for w, _, _ in window)
            covered = sum(min(count, have[w]) for w, count in wanted.items())
            share = covered / len(words)
            if share >= _FUZZY_SHARE and (best is None or share > best[0]):
                best = (share, window[0][1], window[-1][2])
    if best is None:
        return None
    return best[1], best[2]


def find_quote(
    quote: str,
    haystack: FoldedText,
    *,
    start: int = 0,
    end: int | None = None,
) -> QuoteMatch | None:
    """Locate *quote* in the folded *haystack*, between folded offsets.

    An ellipsis in the quote separates fragments that must appear in order.
    Without an exact match, a window that holds nearly all the quote's words
    counts (line breaks, hyphenation and OCR noise break exact matches).
    Returns source offsets.
    """
    if not quote or not quote.strip():
        return None
    end = len(haystack.text) if end is None else end
    whole = fold_plain(quote).strip(" .,;:-\"'")
    if not whole:
        return None
    exact = _find_exact([whole], haystack, start, end)
    if exact is None:
        parts = _quote_parts(quote)
        if len(parts) > 1:
            exact = _find_exact(parts, haystack, start, end)
    if exact is not None:
        source = haystack.source_span(*exact)
        return QuoteMatch(source[0], source[1], exact=True)
    fuzzy = _find_fuzzy(quote, haystack, start, end)
    if fuzzy is not None:
        source = haystack.source_span(*fuzzy)
        return QuoteMatch(source[0], source[1], exact=False)
    return None


def latin_share(text: str) -> float:
    """Share of Latin letters among Latin and Cyrillic ones."""
    latin = sum(1 for ch in text if "a" <= ch.lower() <= "z")
    cyrillic = sum(1 for ch in text if "а" <= ch.lower() <= "я")
    total = latin + cyrillic
    return latin / total if total else 0.0


def shorten(text: str, limit: int) -> str:
    """One-line excerpt of *text* no longer than *limit* characters."""
    line = " ".join(strip_page_marks(text).split())
    if len(line) <= limit:
        return line
    return line[: max(0, limit - 1)].rstrip() + "…"
