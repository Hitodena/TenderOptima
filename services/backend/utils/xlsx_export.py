import io
from typing import Any, Protocol

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

_SUPPLIER_SUBCOLS = ("Предыдущее", "Текущее", "Статус", "Пояснение")
_HEADER_FILL = PatternFill("solid", fgColor="E8EEF4")
_CHANGED_FILL = PatternFill("solid", fgColor="FFF3CD")
_THIN_BORDER = Border(
    left=Side(style="thin", color="CCCCCC"),
    right=Side(style="thin", color="CCCCCC"),
    top=Side(style="thin", color="CCCCCC"),
    bottom=Side(style="thin", color="CCCCCC"),
)
_HEADER_FONT = Font(bold=True)
_STRIKE_FONT = Font(strike=True, color="666666")


class ComparisonSupplierLike(Protocol):
    company_name: str
    main_email: str
    values: dict[str, str | None]
    previous_values: dict[str, str | None]
    explanations: dict[str, str | None]
    corrected_from: dict[str, str | None]
    statuses: dict[str, str | None]


def workbook_to_bytes(wb: Workbook) -> bytes:
    """Serialize an openpyxl workbook to XLSX bytes."""
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def write_sheet_rows(
    ws: Worksheet,
    header: list[str],
    rows: list[list[Any]],
) -> None:
    """Write header row and data rows to a worksheet."""
    ws.append(header)
    for row in rows:
        ws.append(row)


def _display_previous_value(
    supplier: ComparisonSupplierLike,
    req: str,
) -> str:
    corrected = supplier.corrected_from.get(req)
    current = supplier.values.get(req)
    if (
        corrected
        and str(corrected).strip()
        and current
        and str(current).strip()
        and corrected != current
    ):
        return str(corrected)
    prev = supplier.previous_values.get(req)
    return str(prev) if prev else ""


def _values_changed(previous: str, current: str) -> bool:
    prev = previous.strip()
    cur = current.strip()
    return bool(prev and cur and prev != cur)


def _style_header_cell(cell) -> None:
    cell.font = _HEADER_FONT
    cell.fill = _HEADER_FILL
    cell.alignment = Alignment(
        horizontal="center",
        vertical="center",
        wrap_text=True,
    )
    cell.border = _THIN_BORDER


def _style_data_cell(
    cell, *, changed: bool = False, strike: bool = False
) -> None:
    cell.alignment = Alignment(vertical="top", wrap_text=True)
    cell.border = _THIN_BORDER
    if changed:
        cell.fill = _CHANGED_FILL
    if strike:
        cell.font = _STRIKE_FONT


def build_comparison_workbook(
    *,
    requirements: list[str],
    suppliers: list[ComparisonSupplierLike],
    status_labels: dict[str, str],
) -> Workbook:
    """Build a multi-row header comparison sheet with old/new value columns."""
    wb = Workbook()
    ws = wb.active
    if ws is None:
        return wb
    ws.title = "Сравнение"

    cols_per_supplier = len(_SUPPLIER_SUBCOLS)
    ws.cell(row=1, column=1, value="Требование")
    _style_header_cell(ws.cell(row=1, column=1))
    ws.merge_cells(start_row=1, start_column=1, end_row=2, end_column=1)

    for idx, supplier in enumerate(suppliers):
        start_col = 2 + idx * cols_per_supplier
        end_col = start_col + cols_per_supplier - 1
        title = f"{supplier.company_name}\n{supplier.main_email}"
        ws.cell(row=1, column=start_col, value=title)
        _style_header_cell(ws.cell(row=1, column=start_col))
        if end_col > start_col:
            ws.merge_cells(
                start_row=1,
                start_column=start_col,
                end_row=1,
                end_column=end_col,
            )
            for col in range(start_col + 1, end_col + 1):
                _style_header_cell(ws.cell(row=1, column=col))
        for sub_idx, label in enumerate(_SUPPLIER_SUBCOLS):
            col = start_col + sub_idx
            ws.cell(row=2, column=col, value=label)
            _style_header_cell(ws.cell(row=2, column=col))

    for row_idx, req in enumerate(requirements, start=3):
        req_cell = ws.cell(row=row_idx, column=1, value=req)
        _style_data_cell(req_cell)
        req_cell.font = Font(bold=True)

        for sup_idx, supplier in enumerate(suppliers):
            start_col = 2 + sup_idx * cols_per_supplier
            previous = _display_previous_value(supplier, req)
            status_key = supplier.statuses.get(req)
            if status_key == "not_found":
                current = "—"
                status_label = ""
            else:
                current = supplier.values.get(req) or "—"
                status_label = (
                    status_labels.get(status_key, status_key)
                    if status_key
                    else ""
                )
            explanation = supplier.explanations.get(req) or ""
            changed = _values_changed(previous, current)

            prev_cell = ws.cell(row=row_idx, column=start_col, value=previous)
            _style_data_cell(prev_cell, changed=changed, strike=changed)

            cur_cell = ws.cell(
                row=row_idx,
                column=start_col + 1,
                value=current,
            )
            _style_data_cell(cur_cell, changed=changed)

            status_cell = ws.cell(
                row=row_idx,
                column=start_col + 2,
                value=status_label,
            )
            _style_data_cell(status_cell)

            expl_cell = ws.cell(
                row=row_idx,
                column=start_col + 3,
                value=explanation,
            )
            _style_data_cell(expl_cell)

    ws.freeze_panes = "B3"
    ws.row_dimensions[1].height = 36
    ws.row_dimensions[2].height = 24
    ws.column_dimensions["A"].width = 42
    for col_idx in range(
        2,
        2 + len(suppliers) * cols_per_supplier,
    ):
        ws.column_dimensions[get_column_letter(col_idx)].width = 18

    return wb
