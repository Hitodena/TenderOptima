"""Build small .docx files for tests without Word or python-docx.

Tests need full control over the XML (list definitions, tracked changes,
merged cells), so the package is written by hand.
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml"
_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

_CONTENT_TYPES = (
    _HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/'
    'content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-'
    'package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    f'<Override PartName="/word/document.xml" ContentType="{_CT}.document.'
    'main+xml"/>'
    f'<Override PartName="/word/styles.xml" ContentType="{_CT}.styles+xml"/>'
    f'<Override PartName="/word/numbering.xml" ContentType="{_CT}.numbering'
    '+xml"/>'
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.'
    'openxmlformats-officedocument.extended-properties+xml"/>'
    "</Types>"
)
_ROOT_RELS = (
    _HEAD
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
    'relationships">'
    f'<Relationship Id="rId1" Type="{_REL}/officeDocument" '
    'Target="word/document.xml"/>'
    f'<Relationship Id="rId2" Type="{_REL}/extended-properties" '
    'Target="docProps/app.xml"/>'
    "</Relationships>"
)
_DOC_RELS = (
    _HEAD
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
    'relationships">'
    f'<Relationship Id="rId1" Type="{_REL}/styles" Target="styles.xml"/>'
    f'<Relationship Id="rId2" Type="{_REL}/numbering" '
    'Target="numbering.xml"/>'
    "</Relationships>"
)
_BASE_STYLES = (
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
    '<w:name w:val="Normal"/></w:style>'
    '<w:style w:type="paragraph" w:styleId="Title">'
    '<w:name w:val="Title"/><w:basedOn w:val="Normal"/></w:style>'
    '<w:style w:type="paragraph" w:styleId="TOC1">'
    '<w:name w:val="toc 1"/><w:basedOn w:val="Normal"/></w:style>'
)


def text_runs(text: str, *, bold: bool = False) -> str:
    """Runs for *text*; tabs and line breaks become their own elements."""
    rpr = "<w:rPr><w:b/></w:rPr>" if bold else ""
    parts: list[str] = []
    buffer = ""

    def flush() -> None:
        nonlocal buffer
        if buffer:
            parts.append(f'<w:t xml:space="preserve">{escape(buffer)}</w:t>')
            buffer = ""

    for char in text:
        if char == "\t":
            flush()
            parts.append("<w:tab/>")
        elif char == "\n":
            flush()
            parts.append("<w:br/>")
        else:
            buffer += char
    flush()
    return f"<w:r>{rpr}{''.join(parts)}</w:r>" if parts else ""


def paragraph_xml(
    text: str = "",
    *,
    num: tuple[int, int] | None = None,
    style: str | None = None,
    bold: bool = False,
    jc: str | None = None,
    ind: int | None = None,
    outline: int | None = None,
    runs: str | None = None,
    mark: str = "",
) -> str:
    """One ``w:p``; *runs* replaces generated runs, *mark* goes to pPr/rPr."""
    ppr: list[str] = []
    if style:
        ppr.append(f"<w:pStyle w:val={quoteattr(style)}/>")
    if num is not None:
        num_id, ilvl = num
        ppr.append(
            f'<w:numPr><w:ilvl w:val="{ilvl}"/>'
            f'<w:numId w:val="{num_id}"/></w:numPr>'
        )
    if ind is not None:
        ppr.append(f'<w:ind w:left="{ind}"/>')
    if jc:
        ppr.append(f'<w:jc w:val="{jc}"/>')
    if outline is not None:
        ppr.append(f'<w:outlineLvl w:val="{outline}"/>')
    if mark:
        ppr.append(f"<w:rPr>{mark}</w:rPr>")
    ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
    body = runs if runs is not None else text_runs(text, bold=bold)
    return f"<w:p>{ppr_xml}{body}</w:p>"


class DocxBuilder:
    def __init__(self, *, pages: int | None = None) -> None:
        self._body: list[str] = []
        self._abstract: list[str] = []
        self._nums: list[str] = []
        self._styles: list[str] = [_BASE_STYLES]
        self._pages = pages
        for level in (1, 2, 3):
            self.style(
                f"Heading{level}", f"heading {level}", outline=level - 1
            )

    # ---- styles and lists ------------------------------------------

    def style(
        self,
        style_id: str,
        name: str,
        *,
        based_on: str = "Normal",
        num: tuple[int, int | None] | None = None,
        outline: int | None = None,
        bold: bool = False,
        kind: str = "paragraph",
    ) -> DocxBuilder:
        ppr: list[str] = []
        if num is not None:
            num_id, ilvl = num
            lvl = f'<w:ilvl w:val="{ilvl}"/>' if ilvl is not None else ""
            ppr.append(f'<w:numPr>{lvl}<w:numId w:val="{num_id}"/></w:numPr>')
        if outline is not None:
            ppr.append(f'<w:outlineLvl w:val="{outline}"/>')
        ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
        rpr_xml = "<w:rPr><w:b/></w:rPr>" if bold else ""
        based = (
            f"<w:basedOn w:val={quoteattr(based_on)}/>"
            if kind == "paragraph"
            else ""
        )
        self._styles.append(
            f'<w:style w:type="{kind}" w:styleId={quoteattr(style_id)}>'
            f"<w:name w:val={quoteattr(name)}/>{based}{ppr_xml}{rpr_xml}"
            "</w:style>"
        )
        return self

    @staticmethod
    def _level_xml(ilvl: int, level: dict) -> str:
        items = [f'<w:start w:val="{level.get("start", 1)}"/>']
        items.append(f'<w:numFmt w:val="{level.get("fmt", "decimal")}"/>')
        if level.get("restart") is not None:
            items.append(f'<w:lvlRestart w:val="{level["restart"]}"/>')
        if level.get("pstyle"):
            items.append(f'<w:pStyle w:val="{level["pstyle"]}"/>')
        if level.get("lgl"):
            items.append("<w:isLgl/>")
        items.append(
            f"<w:lvlText w:val={quoteattr(level.get('text', '%1.'))}/>"
        )
        items.append('<w:lvlJc w:val="left"/>')
        indent = level.get("indent", 360 * (ilvl + 1))
        items.append(
            f'<w:pPr><w:ind w:left="{indent}" w:hanging="360"/></w:pPr>'
        )
        return f'<w:lvl w:ilvl="{ilvl}">{"".join(items)}</w:lvl>'

    def abstract(
        self,
        abstract_id: int,
        levels: list[dict],
        *,
        extra: str = "",
        kind: str = "multilevel",
    ) -> DocxBuilder:
        """Define a list; each level dict: fmt, text, start, restart, ..."""
        parts = [
            self._level_xml(ilvl, level) for ilvl, level in enumerate(levels)
        ]
        self._abstract.append(
            f'<w:abstractNum w:abstractNumId="{abstract_id}">'
            f'<w:multiLevelType w:val="{kind}"/>{extra}'
            f"{''.join(parts)}</w:abstractNum>"
        )
        return self

    def num(
        self,
        num_id: int,
        abstract_id: int,
        *,
        start_overrides: dict[int, int] | None = None,
        level_overrides: dict[int, dict] | None = None,
    ) -> DocxBuilder:
        overrides = "".join(
            f'<w:lvlOverride w:ilvl="{ilvl}">'
            f'<w:startOverride w:val="{start}"/></w:lvlOverride>'
            for ilvl, start in sorted((start_overrides or {}).items())
        )
        overrides += "".join(
            f'<w:lvlOverride w:ilvl="{ilvl}">'
            f"{self._level_xml(ilvl, level)}</w:lvlOverride>"
            for ilvl, level in sorted((level_overrides or {}).items())
        )
        self._nums.append(
            f'<w:num w:numId="{num_id}">'
            f'<w:abstractNumId w:val="{abstract_id}"/>{overrides}</w:num>'
        )
        return self

    # ---- body ------------------------------------------------------

    def p(self, text: str = "", **kwargs) -> DocxBuilder:
        self._body.append(paragraph_xml(text, **kwargs))
        return self

    def raw(self, xml: str) -> DocxBuilder:
        self._body.append(xml)
        return self

    def table(
        self,
        rows: list[list],
        *,
        header_rows: int = 0,
        n_cols: int | None = None,
    ) -> DocxBuilder:
        """Add a table; a cell is text or a dict (text/span/vmerge/xml)."""
        self._body.append(
            table_xml(rows, header_rows=header_rows, n_cols=n_cols)
        )
        return self

    # ---- output ----------------------------------------------------

    def save(self, path: str | Path) -> Path:
        path = Path(path)
        document = (
            _HEAD
            + f'<w:document xmlns:w="{_W}"><w:body>'
            + "".join(self._body)
            + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>'
            + "</w:body></w:document>"
        )
        styles = (
            _HEAD
            + f'<w:styles xmlns:w="{_W}">{"".join(self._styles)}</w:styles>'
        )
        numbering = (
            _HEAD
            + f'<w:numbering xmlns:w="{_W}">'
            + "".join(self._abstract)
            + "".join(self._nums)
            + "</w:numbering>"
        )
        pages = f"<Pages>{self._pages}</Pages>" if self._pages else ""
        app = (
            _HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/'
            f'officeDocument/2006/extended-properties">{pages}</Properties>'
        )
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("[Content_Types].xml", _CONTENT_TYPES)
            package.writestr("_rels/.rels", _ROOT_RELS)
            package.writestr("word/_rels/document.xml.rels", _DOC_RELS)
            package.writestr("word/document.xml", document)
            package.writestr("word/styles.xml", styles)
            package.writestr("word/numbering.xml", numbering)
            package.writestr("docProps/app.xml", app)
        return path


def table_xml(
    rows: list[list],
    *,
    header_rows: int = 0,
    n_cols: int | None = None,
) -> str:
    def width(cell) -> int:
        return cell.get("span", 1) if isinstance(cell, dict) else 1

    columns = n_cols or max(sum(width(cell) for cell in row) for row in rows)
    grid = "".join('<w:gridCol w:w="2000"/>' for _ in range(columns))
    borders = "".join(
        f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        for side in ("top", "left", "bottom", "right", "insideH", "insideV")
    )
    row_xml: list[str] = []
    for index, row in enumerate(rows):
        cells: list[str] = []
        for cell in row:
            spec = cell if isinstance(cell, dict) else {"text": str(cell)}
            tcpr = [
                f'<w:tcW w:w="{2000 * spec.get("span", 1)}" w:type="dxa"/>'
            ]
            if spec.get("span", 1) > 1:
                tcpr.append(f'<w:gridSpan w:val="{spec["span"]}"/>')
            if spec.get("vmerge") == "restart":
                tcpr.append('<w:vMerge w:val="restart"/>')
            elif spec.get("vmerge") == "continue":
                tcpr.append("<w:vMerge/>")
            if "xml" in spec:
                content = spec["xml"]
            else:
                content = "".join(
                    paragraph_xml(
                        line,
                        bold=spec.get("bold", False),
                        num=spec.get("num"),
                    )
                    for line in spec.get("text", "").split("\n\n")
                )
            cells.append(
                f"<w:tc><w:tcPr>{''.join(tcpr)}</w:tcPr>{content}</w:tc>"
            )
        trpr = "<w:trPr><w:tblHeader/></w:trPr>" if index < header_rows else ""
        row_xml.append(f"<w:tr>{trpr}{''.join(cells)}</w:tr>")
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'
        f"<w:tblBorders>{borders}</w:tblBorders></w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>{''.join(row_xml)}</w:tbl>"
    )
