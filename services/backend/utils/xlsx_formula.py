"""Small evaluator for the formulas of commercial-offer spreadsheets.

Excel stores the last computed value of each formula next to it. Files made
by other programs (1С exports, web generators, Python scripts) often store
only the formula, so «Сумма = Цена × Кол-во» reads as an empty cell. The
formulas in such offers are simple; this evaluates exactly those:

    numbers, percents, cells (A1, $B$2), ranges (E2:E9) on the same sheet,
    + - * / ^, unary minus, parentheses,
    SUM, ROUND, ROUNDUP, ROUNDDOWN, MIN, MAX, AVERAGE, ABS, PRODUCT, INT
    (and the Russian names СУММ, ОКРУГЛ, …).

Anything else (other sheets, IF, VLOOKUP, text) gives None: the cell stays
empty rather than holding a guess. No ``eval``.
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable

from openpyxl.utils.cell import column_index_from_string

CellGetter = Callable[[int, int], object]

_TOKEN_RE = re.compile(
    r"\s*(?:"
    r"(?P<num>\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)(?P<pct>%)?"
    r"|(?P<range>\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+)"
    r"|(?P<cell>\$?[A-Z]{1,3}\$?\d+)"
    r"|(?P<func>[A-ZА-ЯЁ][A-ZА-ЯЁ0-9.]*)\s*\("
    r"|(?P<op>[-+*/^(),;])"
    r")",
    re.IGNORECASE,
)

_FUNCTIONS = {
    "SUM": "SUM",
    "СУММ": "SUM",
    "ROUND": "ROUND",
    "ОКРУГЛ": "ROUND",
    "ROUNDUP": "ROUNDUP",
    "ОКРУГЛВВЕРХ": "ROUNDUP",
    "ROUNDDOWN": "ROUNDDOWN",
    "ОКРУГЛВНИЗ": "ROUNDDOWN",
    "MIN": "MIN",
    "МИН": "MIN",
    "MAX": "MAX",
    "МАКС": "MAX",
    "AVERAGE": "AVERAGE",
    "СРЗНАЧ": "AVERAGE",
    "ABS": "ABS",
    "PRODUCT": "PRODUCT",
    "ПРОИЗВЕД": "PRODUCT",
    "INT": "INT",
    "ЦЕЛОЕ": "INT",
}


class FormulaError(Exception):
    """The formula is outside the supported subset."""


def _cell_ref(ref: str) -> tuple[int, int]:
    m = re.fullmatch(r"\$?([A-Z]{1,3})\$?(\d+)", ref.upper())
    if not m:
        raise FormulaError(ref)
    return int(m.group(2)), column_index_from_string(m.group(1))


def _tokens(formula: str) -> list[tuple[str, str]]:
    text = formula.strip()
    if text.startswith("="):
        text = text[1:]
    out: list[tuple[str, str]] = []
    pos = 0
    while pos < len(text):
        if text[pos:].strip() == "":
            break
        m = _TOKEN_RE.match(text, pos)
        if not m or m.end() == pos:
            raise FormulaError(text[pos:])
        pos = m.end()
        if m.group("num") is not None:
            value = float(m.group("num"))
            out.append(("num", str(value / 100 if m.group("pct") else value)))
        elif m.group("range"):
            out.append(("range", m.group("range")))
        elif m.group("cell"):
            out.append(("cell", m.group("cell")))
        elif m.group("func"):
            name = _FUNCTIONS.get(m.group("func").upper())
            if name is None:
                raise FormulaError(m.group("func"))
            out.append(("func", name))
        else:
            op = m.group("op")
            out.append(("op", "," if op == ";" else op))
    return out


class _Parser:
    def __init__(self, tokens, value_of: Callable[[int, int], float | None]):
        self.tokens = tokens
        self.i = 0
        self.value_of = value_of

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def take(self):
        tok = self.peek()
        if tok is None:
            raise FormulaError("end")
        self.i += 1
        return tok

    def expect(self, op: str) -> None:
        tok = self.take()
        if tok != ("op", op):
            raise FormulaError(f"expected {op}")

    # expr := term (('+'|'-') term)*
    def expr(self) -> float:
        value = self.term()
        while self.peek() in (("op", "+"), ("op", "-")):
            op = self.take()[1]
            right = self.term()
            value = value + right if op == "+" else value - right
        return value

    def term(self) -> float:
        value = self.power()
        while self.peek() in (("op", "*"), ("op", "/")):
            op = self.take()[1]
            right = self.power()
            if op == "/":
                if right == 0:
                    raise FormulaError("division by zero")
                value = value / right
            else:
                value = value * right
        return value

    def power(self) -> float:
        value = self.unary()
        if self.peek() == ("op", "^"):
            self.take()
            value = value ** self.unary()
        return value

    def unary(self) -> float:
        if self.peek() == ("op", "-"):
            self.take()
            return -self.unary()
        if self.peek() == ("op", "+"):
            self.take()
            return self.unary()
        return self.atom()

    def atom(self) -> float:
        kind, text = self.take()
        if kind == "num":
            return float(text)
        if kind == "cell":
            value = self.value_of(*_cell_ref(text))
            if value is None:
                return 0.0  # an empty cell counts as 0, as in Excel
            return value
        if kind == "op" and text == "(":
            value = self.expr()
            self.expect(")")
            return value
        if kind == "func":
            return self.call(text)
        raise FormulaError(text)

    def args(self) -> list[float]:
        values: list[float] = []
        if self.peek() == ("op", ")"):
            self.take()
            return values
        while True:
            tok = self.peek()
            if tok and tok[0] == "range":
                self.take()
                values.extend(self.range_values(tok[1]))
            else:
                values.append(self.expr())
            tok = self.take()
            if tok == ("op", ")"):
                return values
            if tok != ("op", ","):
                raise FormulaError("bad arguments")

    def range_values(self, ref: str) -> list[float]:
        start, end = ref.split(":")
        r1, c1 = _cell_ref(start)
        r2, c2 = _cell_ref(end)
        if (r2 - r1 + 1) * (c2 - c1 + 1) > 10_000:
            raise FormulaError("range too large")
        values = []
        for r in range(min(r1, r2), max(r1, r2) + 1):
            for c in range(min(c1, c2), max(c1, c2) + 1):
                value = self.value_of(r, c)
                if value is not None:
                    values.append(value)
        return values

    def call(self, name: str) -> float:
        values = self.args()
        if name == "SUM":
            return math.fsum(values)
        if name == "PRODUCT":
            return math.prod(values) if values else 0.0
        if name in {"MIN", "MAX", "AVERAGE"}:
            if not values:
                return 0.0
            if name == "MIN":
                return min(values)
            if name == "MAX":
                return max(values)
            return math.fsum(values) / len(values)
        if name == "ABS" and len(values) == 1:
            return abs(values[0])
        if name == "INT" and len(values) == 1:
            return float(math.floor(values[0]))
        if name in {"ROUND", "ROUNDUP", "ROUNDDOWN"} and len(values) == 2:
            number, digits = values[0], int(values[1])
            factor = 10**digits
            if name == "ROUND":  # Excel rounds half away from zero
                return (
                    math.copysign(
                        math.floor(abs(number) * factor + 0.5), number
                    )
                    / factor
                )
            if name == "ROUNDUP":
                return (
                    math.copysign(
                        math.ceil(abs(number) * factor - 1e-9), number
                    )
                    / factor
                )
            return (
                math.copysign(math.floor(abs(number) * factor + 1e-9), number)
                / factor
            )
        raise FormulaError(name)


def evaluate_sheet(
    formulas: dict[tuple[int, int], str],
    values: dict[tuple[int, int], object],
) -> dict[tuple[int, int], float]:
    """Compute every formula cell that can be computed.

    ``formulas`` — (row, col) → «=B2*C2»; ``values`` — plain cell values.
    Formulas may refer to other formulas; cycles and unsupported formulas
    are left out of the result.
    """
    done: dict[tuple[int, int], float | None] = {}
    active: set[tuple[int, int]] = set()

    def value_of(row: int, col: int) -> float | None:
        key = (row, col)
        if key in formulas:
            result = compute(key)
            if result is None:  # depends on a formula we cannot compute
                raise FormulaError("unsupported reference")
            return result
        raw = values.get(key)
        if isinstance(raw, bool):
            return float(raw)
        if isinstance(raw, int | float):
            return float(raw)
        if isinstance(raw, str):
            text = raw.replace(" ", "").replace(" ", "").replace(",", ".")
            try:
                return float(text)
            except ValueError:
                return None
        return None

    def compute(key: tuple[int, int]) -> float | None:
        if key in done:
            return done[key]
        if key in active:  # a cycle
            raise FormulaError("cycle")
        active.add(key)
        try:
            parser = _Parser(_tokens(formulas[key]), value_of)
            result = parser.expr()
            if parser.peek() is not None:
                raise FormulaError("trailing tokens")
            done[key] = round(result, 10)
        except (FormulaError, OverflowError, ValueError):
            done[key] = None
        finally:
            active.discard(key)
        if done[key] is None:
            raise FormulaError("unsupported")
        return done[key]

    out: dict[tuple[int, int], float] = {}
    for key in formulas:
        try:
            value = compute(key)
        except FormulaError:
            continue
        if value is not None:
            out[key] = value
    return out
