"""Read a Word document into ordered blocks without rendering it to PDF.

Paragraphs keep their real structure: style, list level, the automatic
number Word shows for them, table cells with merges. Tracked changes are
resolved to the final text and hidden text is dropped.
"""

from __future__ import annotations

import posixpath
import re
import zipfile
from pathlib import Path

from lxml import etree

from backend.services.tz_structure._xml import (
    A_NS,
    PKG_REL_NS,
    V_NS,
    flag,
    is_on,
    m,
    mc,
    parse_xml,
    to_int,
    val,
    w,
)
from backend.services.tz_structure.model import (
    Cell,
    DocModel,
    DocStats,
    Paragraph,
    Row,
    Table,
)
from backend.services.tz_structure.numbering import NumberingResolver
from backend.services.tz_structure.styles import StyleSheet

_MAX_PART_BYTES = 300 * 1024 * 1024
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_INLINE_CONTAINERS = {
    w("hyperlink"),
    w("smartTag"),
    w("fldSimple"),
    w("customXml"),
    w("dir"),
    w("bdo"),
}
_INSERTED = {w("ins"), w("moveTo")}
_DELETED = {w("del"), w("moveFrom")}
_DRAWINGS = {w("drawing"), w("pict"), w("object")}


class DocxReadError(Exception):
    """The file cannot be read as a Word document."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _utf16(text: str) -> bytes:
    return text.encode("utf-16-le")


def _open_package(path: Path) -> zipfile.ZipFile:
    if not path.is_file():
        raise DocxReadError("not_found", "Файл не найден.")
    with path.open("rb") as handle:
        head = handle.read(8)
    if head == _OLE_MAGIC:
        data = path.read_bytes()
        if _utf16("EncryptedPackage") in data:
            raise DocxReadError(
                "encrypted",
                "Документ защищён паролем. Снимите защиту и загрузите "
                "файл заново.",
            )
        if _utf16("WordDocument") in data:
            raise DocxReadError(
                "legacy_doc",
                "Это старый формат Word (.doc). Его нужно преобразовать "
                "в .docx.",
            )
        raise DocxReadError("not_word", "Файл не является документом Word.")
    try:
        return zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise DocxReadError(
            "not_word", "Файл не является документом Word (.docx)."
        ) from exc


def _read_part(package: zipfile.ZipFile, name: str) -> bytes | None:
    try:
        info = package.getinfo(name)
    except KeyError:
        return None
    if info.file_size > _MAX_PART_BYTES:
        raise DocxReadError("too_large", "Документ слишком большой.")
    return package.read(info)


def _related_part(
    package: zipfile.ZipFile, source: str, type_suffix: str
) -> str | None:
    """Target of the relationship of *source* whose type ends with suffix."""
    folder, name = posixpath.split(source)
    rels_name = posixpath.join(folder, "_rels", f"{name}.rels")
    data = _read_part(package, rels_name)
    if data is None:
        return None
    try:
        root = parse_xml(data)
    except etree.XMLSyntaxError:
        return None
    for rel in root.iter(f"{{{PKG_REL_NS}}}Relationship"):
        if not (rel.get("Type") or "").endswith(type_suffix):
            continue
        if rel.get("TargetMode") == "External":
            continue
        target = rel.get("Target") or ""
        if target.startswith("/"):
            return target.lstrip("/")
        return posixpath.normpath(posixpath.join(folder, target))
    return None


class _ParagraphContext:
    def __init__(self, page: int | None) -> None:
        self.parts: list[str] = []
        self.page_start = page
        self.has_image = False
        self.text_runs = 0
        self.bold_runs = 0
        self.caps_runs = 0
        self.textboxes: list = []

    def has_text(self) -> bool:
        return any(part.strip() for part in self.parts)


class _Reader:
    def __init__(
        self,
        styles: StyleSheet,
        numbering: NumberingResolver,
        *,
        has_rendered_pages: bool,
    ) -> None:
        self.styles = styles
        self.numbering = numbering
        self.stats = DocStats()
        self._has_pages = has_rendered_pages
        self._page = 1
        self._index = 0
        self._carry = ""  # text of a paragraph whose mark was deleted

    # ---- pages -----------------------------------------------------

    def _current_page(self) -> int | None:
        return self._page if self._has_pages else None

    def total_pages(self) -> int | None:
        return self._page if self._has_pages else None

    def _next_index(self) -> int:
        self._index += 1
        return self._index

    # ---- blocks ----------------------------------------------------

    def read_blocks(self, container) -> list[Paragraph | Table]:
        blocks: list[Paragraph | Table] = []
        for child in container:
            tag = child.tag
            if tag == w("p"):
                blocks.extend(self._read_paragraph(child))
            elif tag == w("tbl"):
                blocks.append(self._read_table(child))
            elif tag == w("sdt"):
                content = child.find(w("sdtContent"))
                if content is not None:
                    blocks.extend(self.read_blocks(content))
            elif tag in _INSERTED or tag == w("customXml"):
                blocks.extend(self.read_blocks(child))
            elif tag == mc("AlternateContent"):
                target = _choice(child)
                if target is not None:
                    blocks.extend(self.read_blocks(target))
        return blocks

    # ---- paragraphs ------------------------------------------------

    def _read_paragraph(self, element) -> list[Paragraph]:
        ppr = element.find(w("pPr"))
        style_id = val(ppr, "pStyle") or self.styles.default_paragraph
        mark_rpr = ppr.find(w("rPr")) if ppr is not None else None
        mark_deleted = (
            mark_rpr is not None and mark_rpr.find(w("del")) is not None
        )
        mark_hidden = bool(flag(mark_rpr, "vanish"))

        ctx = _ParagraphContext(self._current_page())
        style_bold = bool(self.styles.get(style_id, "bold"))
        style_caps = bool(self.styles.get(style_id, "caps"))
        self._collect(element, ctx, style_bold, style_caps)

        text = "".join(ctx.parts).replace(" ", " ")
        text = self._carry + text
        self._carry = ""

        if mark_deleted:
            # Accepting the deletion merges this paragraph into the next.
            self.stats.tracked_deletions += 1
            self._carry = text
            return self._read_textboxes(ctx)
        if mark_hidden and not text.strip():
            return self._read_textboxes(ctx)

        index = self._next_index()
        is_toc = self.styles.is_toc(style_id)
        label = None
        if not is_toc:
            label = self._numbering_label(ppr, style_id)

        paragraph = Paragraph(
            index=index,
            text=text.strip(" \t\n"),
            label=label,
            style_id=style_id,
            style_name=self.styles.name(style_id),
            heading_level=self._heading_level(ppr, style_id),
            is_title=self.styles.is_title(style_id),
            bold=ctx.text_runs > 0 and ctx.bold_runs == ctx.text_runs,
            caps=ctx.text_runs > 0 and ctx.caps_runs == ctx.text_runs,
            align=val(ppr, "jc") or self.styles.get(style_id, "align") or "",
            indent=self._indent(ppr, style_id),
            page=ctx.page_start,
            has_image=ctx.has_image,
            is_toc=is_toc,
        )
        self.stats.paragraphs += 1
        if is_toc:
            self.stats.toc_paragraphs += 1
        return [paragraph, *self._read_textboxes(ctx)]

    def _heading_level(self, ppr, style_id: str) -> int | None:
        direct = to_int(val(ppr, "outlineLvl"))
        if direct is not None:
            return direct + 1 if 0 <= direct <= 8 else None
        return self.styles.heading_level(style_id)

    def _num_props(self, ppr, style_id: str) -> tuple[str, int] | None:
        """List instance and level of a paragraph, as Word resolves them."""
        numpr = ppr.find(w("numPr")) if ppr is not None else None
        direct_num = val(numpr, "numId")
        direct_lvl = to_int(val(numpr, "ilvl"))
        if direct_num is not None:
            if direct_num == "0":
                return None
            return direct_num, direct_lvl or 0
        inherited = self.styles.numbering(style_id)
        if inherited is None or inherited[0] == "0":
            return None
        num_id, style_lvl = inherited
        if direct_lvl is not None:
            return num_id, direct_lvl
        ilvl = style_lvl or 0
        chain = self.styles.chain_ids(style_id)
        if not self.numbering.style_may_use(num_id, ilvl, chain):
            return None
        return num_id, ilvl

    def _numbering_label(self, ppr, style_id: str):
        props = self._num_props(ppr, style_id)
        if props is None:
            return None
        num_id, ilvl = props
        if not self.numbering.is_defined(num_id):
            self.stats.broken_numbering_refs += 1
            return None
        return self.numbering.next_label(num_id, ilvl)

    def _indent(self, ppr, style_id: str) -> int:
        ind = ppr.find(w("ind")) if ppr is not None else None
        if ind is not None:
            direct = to_int(ind.get(w("left")) or ind.get(w("start")))
            if direct is not None:
                return direct
        props = self._num_props(ppr, style_id)
        if props is not None:
            from_list = self.numbering.indent_for(*props)
            if from_list is not None:
                return from_list
        return self.styles.get(style_id, "indent") or 0

    # ---- inline content --------------------------------------------

    def _collect(
        self, element, ctx: _ParagraphContext, bold: bool, caps: bool
    ) -> None:
        for child in element:
            tag = child.tag
            if tag == w("r"):
                self._read_run(child, ctx, bold, caps)
            elif tag in _INLINE_CONTAINERS:
                self._collect(child, ctx, bold, caps)
            elif tag in _INSERTED:
                self.stats.tracked_insertions += 1
                self._collect(child, ctx, bold, caps)
            elif tag in _DELETED:
                self.stats.tracked_deletions += 1
            elif tag == w("sdt"):
                content = child.find(w("sdtContent"))
                if content is not None:
                    self._collect(content, ctx, bold, caps)
            elif tag == mc("AlternateContent"):
                target = _choice(child)
                if target is not None:
                    self._collect(target, ctx, bold, caps)
            elif tag in (m("oMath"), m("oMathPara")):
                formula = "".join(
                    node.text or "" for node in child.iter(m("t"))
                )
                if formula:
                    ctx.parts.append(formula)
                    self.stats.formulas += 1

    def _read_run(
        self, run, ctx: _ParagraphContext, bold: bool, caps: bool
    ) -> None:
        rpr = run.find(w("rPr"))
        if flag(rpr, "vanish"):
            self.stats.hidden_runs += 1
            return
        run_bold = flag(rpr, "b")
        run_caps = flag(rpr, "caps")
        is_bold = bold if run_bold is None else run_bold
        is_caps = caps if run_caps is None else run_caps
        self._read_run_children(run, ctx, is_bold, is_caps)

    def _read_run_children(
        self, container, ctx: _ParagraphContext, bold: bool, caps: bool
    ) -> None:
        for child in container:
            tag = child.tag
            if tag == w("t"):
                text = child.text or ""
                ctx.parts.append(text)
                if text.strip():
                    ctx.text_runs += 1
                    ctx.bold_runs += bold
                    letters = [char for char in text if char.isalpha()]
                    is_upper = bool(letters) and all(
                        char.isupper() for char in letters
                    )
                    ctx.caps_runs += caps or is_upper
            elif tag in (w("tab"), w("ptab")):
                ctx.parts.append("\t")
            elif tag == w("br"):
                kind = child.get(w("type"))
                ctx.parts.append(" " if kind in ("page", "column") else "\n")
            elif tag == w("cr"):
                ctx.parts.append("\n")
            elif tag == w("noBreakHyphen"):
                ctx.parts.append("-")
            elif tag == w("lastRenderedPageBreak"):
                self._page += 1
                if not ctx.has_text():
                    ctx.page_start = self._current_page()
            elif tag in _DRAWINGS:
                self._read_drawing(child, ctx)
            elif tag == mc("AlternateContent"):
                target = _choice(child)
                if target is not None:
                    self._read_run_children(target, ctx, bold, caps)
            elif tag in (w("footnoteReference"), w("endnoteReference")):
                self.stats.footnotes += 1

    def _read_drawing(self, element, ctx: _ParagraphContext) -> None:
        if element.tag == w("object"):
            self.stats.embedded_objects += 1
            return
        boxes = _find_textboxes(element)
        if boxes:
            ctx.textboxes.extend(boxes)
            return
        has_picture = (
            next(element.iter(f"{{{A_NS}}}blip"), None) is not None
            or next(element.iter(f"{{{V_NS}}}imagedata"), None) is not None
        )
        if has_picture:
            self.stats.images += 1
            ctx.has_image = True

    def _read_textboxes(self, ctx: _ParagraphContext) -> list[Paragraph]:
        result: list[Paragraph] = []
        for box in ctx.textboxes:
            self.stats.textboxes += 1
            for block in self.read_blocks(box):
                if isinstance(block, Paragraph):
                    block.from_textbox = True
                    result.append(block)
                else:
                    for row in block.rows:
                        for cell in row.cells:
                            for paragraph in cell.paragraphs:
                                paragraph.from_textbox = True
                                result.append(paragraph)
        return result

    # ---- tables ----------------------------------------------------

    def _read_table(self, element) -> Table:
        index = self._next_index()
        page = self._current_page()
        grid = element.find(w("tblGrid"))
        n_cols = len(grid.findall(w("gridCol"))) if grid is not None else 0
        rows: list[Row] = []
        for tr in _iter_wrapped(element, w("tr")):
            trpr = tr.find(w("trPr"))
            if trpr is not None and trpr.find(w("del")) is not None:
                self.stats.tracked_deletions += 1
                continue
            col = to_int(val(trpr, "gridBefore"), 0) or 0
            cells: list[Cell] = []
            for tc in _iter_wrapped(tr, w("tc")):
                tcpr = tc.find(w("tcPr"))
                span = to_int(val(tcpr, "gridSpan"), 1) or 1
                merge_el = tcpr.find(w("vMerge")) if tcpr is not None else None
                v_merge = ""
                if merge_el is not None:
                    restart = merge_el.get(w("val")) == "restart"
                    v_merge = "restart" if restart else "continue"
                cell = Cell(
                    paragraphs=[], col=col, col_span=span, v_merge=v_merge
                )
                self._read_cell(tc, cell)
                cells.append(cell)
                col += span
            header = trpr is not None and is_on(trpr.find(w("tblHeader")))
            rows.append(Row(cells=cells, is_header=header))
            n_cols = max(n_cols, col)
        self.stats.tables += 1
        return Table(index=index, rows=rows, n_cols=n_cols, page=page)

    def _read_cell(self, container, cell: Cell) -> None:
        for child in container:
            tag = child.tag
            if tag == w("p"):
                cell.paragraphs.extend(self._read_paragraph(child))
            elif tag == w("tbl"):
                cell.nested_tables += 1
                self.stats.nested_tables += 1
                nested = self._read_table(child)
                self.stats.tables -= 1
                for row in nested.rows:
                    line = " | ".join(
                        item.text.replace("\n", " ") for item in row.cells
                    )
                    if line.strip(" |"):
                        cell.paragraphs.append(
                            Paragraph(index=self._next_index(), text=line)
                        )
            elif tag == w("sdt"):
                content = child.find(w("sdtContent"))
                if content is not None:
                    self._read_cell(content, cell)
            elif tag in _INSERTED or tag == w("customXml"):
                self._read_cell(child, cell)


def _choice(alternate):
    """Preferred branch of ``mc:AlternateContent`` (never both)."""
    choice = alternate.find(mc("Choice"))
    if choice is not None:
        return choice
    return alternate.find(mc("Fallback"))


def _find_textboxes(element) -> list:
    """Text box contents below *element*, one branch per AlternateContent."""
    found: list = []

    def visit(node) -> None:
        for child in node:
            if child.tag == w("txbxContent"):
                found.append(child)
            elif child.tag == mc("AlternateContent"):
                target = _choice(child)
                if target is not None:
                    visit(target)
            else:
                visit(child)

    visit(element)
    return found


def _iter_wrapped(container, tag: str):
    """Direct children with *tag*, looking through content-control wrappers."""
    for child in container:
        if child.tag == tag:
            yield child
        elif child.tag == w("sdt"):
            content = child.find(w("sdtContent"))
            if content is not None:
                yield from _iter_wrapped(content, tag)
        elif child.tag in _INSERTED or child.tag == w("customXml"):
            yield from _iter_wrapped(child, tag)


def read_docx(path: str | Path) -> DocModel:
    """Read *path* (.docx) into ordered paragraphs and tables."""
    path = Path(path)
    package = _open_package(path)
    with package:
        main = (
            _related_part(package, "", "/officeDocument")
            or "word/document.xml"
        )
        document_xml = _read_part(package, main)
        if document_xml is None:
            raise DocxReadError(
                "not_word", "Файл не является документом Word (.docx)."
            )
        styles_name = _related_part(package, main, "/styles")
        numbering_name = _related_part(package, main, "/numbering")
        styles_xml = _read_part(package, styles_name or "word/styles.xml")
        numbering_xml = _read_part(
            package, numbering_name or "word/numbering.xml"
        )
        app_xml = _read_part(package, "docProps/app.xml")

    try:
        document = parse_xml(document_xml)
        styles = StyleSheet(
            parse_xml(styles_xml) if styles_xml is not None else None
        )
        numbering = NumberingResolver(
            parse_xml(numbering_xml) if numbering_xml is not None else None,
            styles.numbering_style_num_id,
        )
    except etree.XMLSyntaxError as exc:
        raise DocxReadError(
            "corrupt", "Документ повреждён: его не удалось прочитать."
        ) from exc

    body = document.find(w("body"))
    if body is None:
        raise DocxReadError(
            "not_word", "Файл не является документом Word (.docx)."
        )
    # Word stores where pages broke at the last save; a one-page document
    # has no such marks, so its page count comes from the file properties.
    has_pages = b"lastRenderedPageBreak" in document_xml
    if not has_pages and app_xml is not None:
        pages = re.search(rb"<Pages>(\d+)</Pages>", app_xml)
        has_pages = bool(pages) and int(pages.group(1)) == 1
    reader = _Reader(styles, numbering, has_rendered_pages=has_pages)
    blocks = reader.read_blocks(body)
    reader.stats.pages = reader.total_pages()
    return DocModel(blocks=blocks, stats=reader.stats)
