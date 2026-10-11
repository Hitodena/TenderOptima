"""Human-readable views of an extraction result: text outline and HTML."""

from __future__ import annotations

from html import escape

from backend.services.tz_structure.model import (
    ExtractionResult,
    Node,
    NodeKind,
)

_MARKS = {
    NodeKind.HEADING: "#",
    NodeKind.PARAGRAPH: "·",
    NodeKind.TABLE: "[T]",
    NodeKind.TABLE_GROUP: "[G]",
    NodeKind.TABLE_ROW: "[R]",
    NodeKind.SECTION: "§",
}


def outline_lines(
    result: ExtractionResult, *, width: int = 70, numbers: bool = False
) -> list[str]:
    """Compact indented outline: one line per node, warnings below it.

    With *numbers* the system-assigned sub-point numbers are shown too,
    in square brackets, so reference outlines also guard them.
    """
    lines: list[str] = []

    def walk(node: Node, depth: int) -> None:
        mark = node.label or _MARKS.get(node.kind, "")
        if numbers and node.number_origin == "system":
            mark = f"[{node.number}]"
        text = " ".join(node.text.split())
        if len(text) > width:
            text = f"{text[: width - 1]}…"
        lines.append(f"{'  ' * depth}{mark} | {text}".rstrip())
        for warning in node.warnings:
            lines.append(f"{'  ' * depth}  ! {warning}")
        for child in node.children:
            walk(child, depth + 1)

    for node in result.nodes:
        walk(node, 0)
    return lines


def outline_text(result: ExtractionResult) -> str:
    lines = outline_lines(result, width=10_000, numbers=True)
    return "\n".join(lines) + "\n"


_CSS = """
:root{--bg:#f6f7f9;--card:#fff;--ink:#1c2330;--muted:#6b7686;--line:#e3e7ee;
--accent:#1f5fbf;--warn-bg:#fff6e5;--warn-ink:#8a5a00;--warn-line:#f1d9a6;
--info-bg:#eef4fd;--info-ink:#2a5298;--head:#f0f3f8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:15px/1.5 "Segoe UI",system-ui,-apple-system,Arial,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 20px}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 22px}
.chip{background:var(--card);border:1px solid var(--line);border-radius:10px;
padding:10px 14px;min-width:120px}
.chip b{display:block;font-size:22px;line-height:1.2}
.chip span{color:var(--muted);font-size:13px}
.panel{background:var(--card);border:1px solid var(--line);
border-radius:12px;padding:16px 18px;margin:0 0 22px}
.panel h2{font-size:16px;margin:0 0 10px}
.issues{margin:0;padding:0;list-style:none}
.issues li{padding:8px 10px;border-radius:8px;margin:0 0 6px}
.issues .warning{background:var(--warn-bg);color:var(--warn-ink);
border:1px solid var(--warn-line)}
.issues .info{background:var(--info-bg);color:var(--info-ink)}
.issues a{color:inherit;font-weight:600}
.node{display:grid;grid-template-columns:92px 1fr auto;column-gap:12px;
padding:7px 8px;border-top:1px solid var(--line);align-items:start}
.tree>.node:first-child{border-top:0}
.num{font-variant-numeric:tabular-nums;font-weight:600;color:var(--accent);
text-align:right;white-space:nowrap;overflow-wrap:anywhere}
.num.none{color:#b3bbc8;font-weight:400}
.txt{white-space:pre-wrap;overflow-wrap:anywhere}
.pg{color:var(--muted);font-size:12px;white-space:nowrap;padding-top:3px}
.kids{margin-left:26px;border-left:2px solid var(--line)}
.heading>.txt,.section>.txt,.item.is-heading>.txt{font-weight:600}
.heading,.section{background:var(--head)}
.bullet>.num{color:var(--muted)}
.sys>.num{color:#7a8597;font-weight:500;font-style:italic}
.paragraph>.txt{color:#333c4b}
.note{grid-column:2/4;margin-top:4px;background:var(--warn-bg);
color:var(--warn-ink);border:1px solid var(--warn-line);border-radius:6px;
padding:3px 8px;font-size:13px}
.tbl{grid-column:1/4;overflow-x:auto;margin:4px 0 6px}
table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}
th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;
vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
th{background:var(--head);font-weight:600}
td.n{width:70px;color:var(--accent);font-weight:600;white-space:nowrap}
tr.group td{background:var(--head);font-weight:600}
tr.sub td{color:#333c4b}
tr.sub td.n{padding-left:20px;color:var(--muted)}
.cap{font-weight:600;margin:2px 0 6px}
.legend{color:var(--muted);font-size:13px;margin:0 0 10px}
"""

_KIND_TITLES = {
    "item": "пунктов с номером",
    "table_row": "строк таблиц",
    "bullet": "перечислений",
    "paragraph": "абзацев без номера",
}


def _row_cells(node: Node, columns: list[str] | None) -> str:
    cells = {item["column"]: item["text"] for item in node.cells or []}
    if node.kind == NodeKind.TABLE_GROUP or not node.cells:
        span = max(1, len(columns or []))
        return f'<td colspan="{span}">{escape(node.text)}</td>'
    if not columns:
        return "".join(
            f"<td>{escape(item['text'])}</td>" for item in node.cells
        )
    return "".join(
        f"<td>{escape(cells.get(column, ''))}</td>" for column in columns
    )


def _table_html(node: Node) -> str:
    columns = node.columns
    width = len(columns) if columns else 0
    if not columns:
        width = max(
            (len(row.cells or []) for row in node.walk() if row is not node),
            default=1,
        )
    data_columns = columns
    if columns:
        used = {
            item["column"] for row in node.walk() for item in (row.cells or [])
        }
        data_columns = [column for column in columns if column in used]
    head = ""
    if data_columns:
        head = (
            "<tr><th>№</th>"
            + "".join(f"<th>{escape(name)}</th>" for name in data_columns)
            + "</tr>"
        )
    body: list[str] = []

    def add(row: Node, depth: int) -> None:
        css = "group" if row.kind == NodeKind.TABLE_GROUP else ""
        if depth:
            css = f"{css} sub".strip()
        notes = "".join(
            f'<div class="note">{escape(warning)}</div>'
            for warning in row.warnings
        )
        label = escape(row.label) or ""
        cells = _row_cells(row, data_columns)
        if not data_columns and row.kind != NodeKind.TABLE_GROUP:
            missing = width - len(row.cells or [])
            cells += "<td></td>" * max(0, missing)
        body.append(
            f'<tr class="{css}" id="{row.id}"><td class="n">{label}</td>'
            f"{cells}</tr>"
        )
        if notes:
            span = (len(data_columns) if data_columns else width) + 1
            body.append(f'<tr><td colspan="{span}">{notes}</td></tr>')
        for child in row.children:
            nested = depth + (row.kind == NodeKind.TABLE_ROW)
            add(child, nested)

    for row in node.children:
        add(row, 0)
    caption = " ".join(part for part in (node.label, node.text) if part)
    cap = f'<div class="cap">{escape(caption)}</div>' if caption else ""
    return f"{cap}<table>{head}{''.join(body)}</table>"


def _node_html(node: Node) -> str:
    notes = "".join(
        f'<div class="note">{escape(warning)}</div>'
        for warning in node.warnings
    )
    if node.kind == NodeKind.TABLE:
        return (
            f'<div class="node table" id="{node.id}">'
            f'<div class="tbl">{_table_html(node)}</div>{notes}</div>'
        )
    classes = [node.kind.value]
    if node.is_heading:
        classes.append("is-heading")
    label = escape(node.label)
    text = escape(node.text)
    if node.kind == NodeKind.SECTION:
        # "Приложение 1" is too long for the number column: show it
        # together with the title.
        text = " ".join(part for part in (label, text) if part)
        label = ""
        mark = ""
    else:
        mark = label or "—"
    if node.number_origin == "system":
        # number assigned by the system: shown, but visibly not the
        # document's own
        label = escape(node.number)
        mark = label
        classes.append("sys")
    num_class = "num" if label else "num none"
    page = f"стр. {node.page}" if node.page else ""
    html = (
        f'<div class="node {" ".join(classes)}" id="{node.id}">'
        f'<div class="{num_class}">{mark}</div>'
        f'<div class="txt">{text}</div>'
        f'<div class="pg">{page}</div>{notes}</div>'
    )
    if node.children:
        kids = "".join(_node_html(child) for child in node.children)
        html += f'<div class="kids">{kids}</div>'
    return html


def report_html(result: ExtractionResult, *, title: str) -> str:
    """Self-contained review page: summary, warnings, tree of points."""
    stats = result.stats
    kinds = stats.get("by_kind", {})
    chips = [
        (stats.get("numbered_points", 0), "пунктов с номером"),
        (kinds.get("bullet", 0), "перечислений без номера"),
        (kinds.get("paragraph", 0), "абзацев без номера"),
        (stats.get("tables_in_file", 0), "таблиц"),
        (stats.get("pages") or "—", "страниц"),
        (stats.get("warnings", 0), "замечаний"),
    ]
    chips_html = "".join(
        f'<div class="chip"><b>{value}</b><span>{escape(name)}</span></div>'
        for value, name in chips
    )
    labels = {node.id: node.label for node in result.walk()}
    issue_items: list[str] = []
    for issue in result.issues:
        link = ""
        if issue.node_id:
            target = labels.get(issue.node_id) or "к месту в документе"
            link = f' <a href="#{issue.node_id}">→ {escape(target)}</a>'
        issue_items.append(
            f'<li class="{issue.severity}">{escape(issue.message)}{link}</li>'
        )
    issues_html = (
        f'<ul class="issues">{"".join(issue_items)}</ul>'
        if issue_items
        else '<p class="legend">Замечаний нет.</p>'
    )
    tree = "".join(_node_html(node) for node in result.nodes)
    return (
        '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{escape(title)}</title><style>{_CSS}</style></head><body>"
        f'<div class="wrap"><h1>{escape(title)}</h1>'
        '<p class="sub">Разбор технического задания: номера пунктов '
        "показаны так, как они стоят в документе.</p>"
        f'<div class="chips">{chips_html}</div>'
        f'<div class="panel"><h2>Требует внимания</h2>{issues_html}</div>'
        '<div class="panel"><h2>Пункты документа</h2>'
        '<p class="legend">Синим — номер из документа. Серым курсивом — '
        "номер, присвоенный системой внутри пункта, чтобы каждый "
        "проверяемый параметр можно было сопоставить с КП; в документе "
        "такого номера нет.</p>"
        f'<div class="tree">{tree}</div></div></div></body></html>'
    )
