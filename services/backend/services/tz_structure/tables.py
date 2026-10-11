"""Interpret Word tables: header, number column, group rows, merged cells.

A specification table is the usual form of a technical requirement list,
so every data row becomes one point that keeps its own cells.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from backend.services.tz_structure.model import Cell, Paragraph, Table

_HEADER_WORDS_RE = re.compile(
    r"№|п\s*/\s*п|наименован|параметр|характеристик|показател|требован"
    r"|значени|величин|ед\.?\s*изм|единиц|кол-?во|количеств|примечан"
    r"|описани|норма|обозначен|содержани",
    re.I,
)
_NUMBER_HEADER_RE = re.compile(
    r"^(?:№|n|no|#)?\s*\.?\s*(?:п\s*[/.]?\s*п\.?|пп|поз(?:иции|\.)?|"
    r"пункта?|п\.)?\s*$",
    re.I,
)
_NUMBER_CELL_RE = re.compile(
    r"^\(?(?:\d{1,3}(?:\.\d{1,3}){0,4}|[а-яa-z])[.)]?$"
)
_ONLY_NUMBER_RE = re.compile(r"^\d{1,3}$")
_UNIT_RE = re.compile(r"ед\.?\s*изм|единиц", re.I)
_VALUE_RE = re.compile(r"значени|величин|норма|содержани|требуем", re.I)
_NAME_RE = re.compile(
    r"наименован|параметр|характеристик|показател|требовани|описани", re.I
)
_EMPTY_VALUES = {"", "-", "–", "—"}


@dataclass
class RowView:
    kind: str  # "row" | "group"
    label: str = ""
    text: str = ""
    cells: list[dict[str, str]] = field(default_factory=list)
    blocks: list[int] = field(default_factory=list)
    page: int | None = None
    sub_row: bool = False  # continues a vertically merged row above


@dataclass
class TableView:
    columns: list[str]
    has_header: bool
    number_col: int | None
    rows: list[RowView]
    nested_tables: int = 0


def is_layout_table(table: Table) -> bool:
    """A one-column table only frames ordinary text."""
    return table.n_cols <= 1


def _clean(text: str) -> str:
    return " ".join(text.split())


_LAYOUT_LABEL_RE = re.compile(
    r"^\(?(?:\d{1,3}(?:\.\d{1,3}){0,5}|[A-Za-zА-Яа-яЁё]|[-–—•*·])[.)]?$"
)


def layout_rows(table: Table) -> list[tuple[str, list[Paragraph]]] | None:
    """Rows of a table that only lays out a numbered text.

    Documents converted from PDF (and many typed ones) keep the point
    number in a narrow first column and the whole point — paragraphs,
    lists — in the second. Such a table is not a specification: it is
    returned as (number, paragraphs) pairs to be read as ordinary text.
    ``None`` means a real table.
    """
    if any(row.is_header for row in table.rows):
        return None
    grid = _grid(table)
    if grid and _looks_like_header(grid[0]):
        return None
    rows: list[tuple[str, list[Paragraph]]] = []
    two_cells = labelled = 0
    for line in grid:
        cells = [
            cell
            for cell in _distinct(line)
            if cell.v_merge != "continue" and _clean(cell.text)
        ]
        if not cells:
            continue
        if len(cells) > 2:
            return None
        if len(cells) == 1:
            rows.append(("", cells[0].paragraphs))
            continue
        two_cells += 1
        label = _clean(cells[0].text)
        if _LAYOUT_LABEL_RE.match(label):
            labelled += 1
            rows.append((label, cells[1].paragraphs))
        else:
            rows.append(("", [*cells[0].paragraphs, *cells[1].paragraphs]))
    if two_cells and labelled / two_cells < 0.6:
        return None
    if not labelled:
        # no numbers at all: framed running text is long and has several
        # paragraphs per cell, while a form to fill in has short cells
        if not rows:
            return None
        paragraphs = sum(len(items) for _label, items in rows)
        letters = sum(
            len(paragraph.text)
            for _label, items in rows
            for paragraph in items
        )
        if letters / len(rows) < 120 and paragraphs / len(rows) < 2:
            return None
    return rows


def _grid(table: Table) -> list[list[Cell | None]]:
    """Rows as lists indexed by grid column; spans repeat the same cell."""
    grid: list[list[Cell | None]] = []
    for row in table.rows:
        line: list[Cell | None] = [None] * table.n_cols
        for cell in row.cells:
            for col in range(cell.col, cell.col + cell.col_span):
                if 0 <= col < table.n_cols:
                    line[col] = cell
        grid.append(line)
    return grid


def _distinct(line: list[Cell | None]) -> list[Cell]:
    seen: list[Cell] = []
    for cell in line:
        if cell is not None and all(cell is not other for other in seen):
            seen.append(cell)
    return seen


def _looks_like_header(line: list[Cell | None]) -> bool:
    cells = [cell for cell in _distinct(line) if _clean(cell.text)]
    if len(cells) < 2:
        return False
    texts = [_clean(cell.text) for cell in cells]
    if any(len(text) > 80 for text in texts):
        return False
    if any(_ONLY_NUMBER_RE.match(text) for text in texts):
        return False
    has_words = any(_HEADER_WORDS_RE.search(text) for text in texts)
    return has_words or all(cell.bold for cell in cells)


def _is_column_number_row(line: list[Cell | None]) -> bool:
    """Row "1 | 2 | 3 | 4" that numbers the columns under the header."""
    texts = [_clean(cell.text) for cell in _distinct(line)]
    if len(texts) < 2 or not all(_ONLY_NUMBER_RE.match(t) for t in texts):
        return False
    return [int(text) for text in texts] == list(range(1, len(texts) + 1))


def _column_names(
    grid: list[list[Cell | None]], header_rows: list[int], n_cols: int
) -> list[str]:
    names: list[str] = []
    for col in range(n_cols):
        parts: list[str] = []
        for row_index in header_rows:
            cell = grid[row_index][col]
            text = _clean(cell.text) if cell is not None else ""
            if text and (not parts or parts[-1] != text):
                parts.append(text)
        names.append(" / ".join(parts) or f"Колонка {col + 1}")
    return names


def _find_number_col(
    grid: list[list[Cell | None]],
    data_rows: list[int],
    columns: list[str],
    has_header: bool,
) -> int | None:
    if has_header:
        for col, name in enumerate(columns):
            if name.startswith("Колонка "):
                continue
            if _NUMBER_HEADER_RE.match(name) and len(name) <= 12:
                return col
    values = []
    for row_index in data_rows:
        cell = grid[row_index][0] if grid[row_index] else None
        if cell is None or cell.col_span > 1:
            continue
        text = _clean(cell.text)
        if text:
            values.append(text)
    if len(values) >= 2:
        hits = sum(bool(_NUMBER_CELL_RE.match(value)) for value in values)
        if hits / len(values) >= 0.7:
            return 0
    return None


def _compose(pairs: list[tuple[str, str]], has_header: bool) -> str:
    """One readable line for a table row from (column, value) pairs."""
    filled = [(name, text) for name, text in pairs if text]
    if not filled:
        return ""
    if len(filled) == 1:
        return filled[0][1]
    if not has_header:
        return " | ".join(text for _, text in filled)
    name = value = unit = None
    rest: list[tuple[str, str]] = []
    for column, text in filled:
        if unit is None and _UNIT_RE.search(column):
            unit = text
        elif value is None and _VALUE_RE.search(column):
            value = text
        elif name is None and _NAME_RE.search(column):
            name = text
        elif name is not None and value is None and _NAME_RE.search(column):
            value = text
        else:
            rest.append((column, text))
    if name is None or value is None:
        return "; ".join(f"{column}: {text}" for column, text in filled)
    line = f"{name}: {value}"
    if unit and unit not in _EMPTY_VALUES:
        line = f"{line} {unit}"
    for column, text in rest:
        if text not in _EMPTY_VALUES:
            line = f"{line}; {column}: {text}"
    return line


def interpret_table(table: Table) -> TableView:
    grid = _grid(table)
    header_rows = [
        index for index, row in enumerate(table.rows) if row.is_header
    ]
    if header_rows and header_rows != list(range(len(header_rows))):
        header_rows = [index for index in header_rows if index == 0]
    if not header_rows and len(grid) >= 2 and _looks_like_header(grid[0]):
        header_rows = [0]
    first_data = len(header_rows)
    if header_rows and first_data < len(grid):
        if _is_column_number_row(grid[first_data]):
            first_data += 1
    has_header = bool(header_rows)
    columns = _column_names(grid, header_rows, table.n_cols)
    data_rows = list(range(first_data, len(grid)))
    number_col = _find_number_col(grid, data_rows, columns, has_header)

    view = TableView(
        columns=columns,
        has_header=has_header,
        number_col=number_col,
        rows=[],
        nested_tables=sum(
            cell.nested_tables for row in table.rows for cell in row.cells
        ),
    )
    carried: dict[int, str] = {}  # text of vertically merged cells
    for row_index in data_rows:
        line = grid[row_index]
        distinct = _distinct(line)
        own = [
            cell
            for cell in distinct
            if cell.v_merge != "continue" and _clean(cell.text)
        ]
        for cell in distinct:
            if cell.v_merge == "restart":
                carried[cell.col] = _clean(cell.text)
            elif cell.v_merge != "continue":
                carried.pop(cell.col, None)
        if not own:
            continue

        blocks = [
            paragraph.index for cell in own for paragraph in cell.paragraphs
        ]
        page = next(
            (
                paragraph.page
                for cell in own
                for paragraph in cell.paragraphs
                if paragraph.page is not None
            ),
            table.page,
        )
        number_cell = line[number_col] if number_col is not None else None
        label = ""
        if number_cell is not None and number_cell.v_merge != "continue":
            if number_cell.col_span == 1:
                label = _clean(number_cell.text)
        content = [
            cell for cell in own if cell is not number_cell or not label
        ]

        if len(content) == 1:
            only = content[0]
            wide = only.col_span >= max(2, table.n_cols - 1)
            if wide or (only.bold and table.n_cols >= 3):
                view.rows.append(
                    RowView(
                        kind="group",
                        label=label,
                        text=_clean(only.text),
                        blocks=blocks,
                        page=page,
                    )
                )
                continue

        pairs: list[tuple[str, str]] = []
        cells_out: list[dict[str, str]] = []
        inherited = False
        for cell in distinct:
            if cell is number_cell and cell.col_span == 1:
                continue
            if cell.v_merge == "continue":
                text = carried.get(cell.col, "")
                inherited = inherited or bool(text)
            else:
                text = cell.text.strip()
            name = columns[cell.col]
            pairs.append((name, _clean(text)))
            if text:
                cells_out.append({"column": name, "text": text})
        sub_row = inherited and not label
        if (
            number_cell is not None
            and number_cell.v_merge == "continue"
            and carried.get(number_cell.col)
        ):
            sub_row = True
        view.rows.append(
            RowView(
                kind="row",
                label=label,
                text=_compose(pairs, has_header),
                cells=cells_out,
                blocks=blocks,
                page=page,
                sub_row=sub_row,
            )
        )
    return view
