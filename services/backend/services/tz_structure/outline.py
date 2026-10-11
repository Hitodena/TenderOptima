"""Build the tree of TZ points from ordered Word blocks.

Rules that protect the customer's reading of the document:

* the number of a point is kept exactly as written and never recalculated;
* repeated numbers, gaps and restarts are reported, not "repaired";
* nothing is merged or dropped: every paragraph ends up in exactly one
  node, in document order.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace

from backend.services.tz_structure.markers import (
    SCOPE_WORDS,
    as_cyrillic,
    letter_follows,
    letter_info,
    split_manual_label,
)
from backend.services.tz_structure.model import (
    DocModel,
    ExtractionResult,
    Issue,
    Label,
    LabelKind,
    Node,
    NodeKind,
    Paragraph,
    Table,
)
from backend.services.tz_structure.tables import (
    TableView,
    interpret_table,
    is_layout_table,
    layout_rows,
)

_HEURISTIC_LEVEL = 99
_CONTENTS_TITLES = {"содержание", "оглавление"}
_BULLET_CHARS = set("-–—•*·")
_TERMINAL = (".", ";", "!", "?")
_DEC_PATH = ("dec-path",)
_TABLE_LABEL_RE = re.compile(r"^(\d{1,3}(?:\.\d{1,3}){0,4})[.)]?$")
_LOOKAHEAD_BLOCKS = 60
_INDENT_STEP = 200  # twips: a clearly deeper indent means a nested list


@dataclass
class _Meta:
    """Builder-only state of a node (never leaves this module)."""

    label: Label | None = None
    abs_path: tuple[int, ...] | None = None
    sig: tuple | None = None
    style: tuple | None = None
    container: bool = False
    scope: bool = False
    heading_level: int | None = None
    indent: int = 0
    # child lists: signature -> (last value, style of the last item)
    seqs: dict[tuple, tuple[object, tuple | None]] = field(
        default_factory=dict
    )
    # scope-wide numbering memory (survives closed parents)
    virt: dict[tuple, int] = field(default_factory=dict)
    seen_paths: set[tuple] = field(default_factory=set)
    last_by_sig: dict[tuple, object] = field(default_factory=dict)
    # heading under which the sub-points of a prefix were last seen
    virt_owner: dict[tuple, str] = field(default_factory=dict)


def _norm(text: str) -> str:
    lines = [" ".join(line.split()) for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


class OutlineBuilder:
    def __init__(self, model: DocModel) -> None:
        self._model = model
        self._issues: list[Issue] = []
        self._meta: dict[str, _Meta] = {}
        self._counter = 0
        self._root = Node(id="root", kind=NodeKind.SECTION)
        self._meta["root"] = _Meta(container=True, scope=True)
        self._open: list[Node] = [self._root]
        self._auto_last: dict[tuple[str, int], Node] = {}
        self._blocks: list[Paragraph | Table] = []
        self._pos = 0
        self._caption: tuple[Paragraph, Label, str] | None = None
        self._before_content = True
        self._image_pages: list[int | None] = []
        self._missing_parents: set[tuple] = set()
        self._touched: Node | None = None
        self._established_bare_paths = False
        self._bold_is_emphasis = True
        self._contents_skipped = 0
        self._column_parent: Node | None = None

    # ---- small helpers ---------------------------------------------

    def _m(self, node: Node) -> _Meta:
        return self._meta[node.id]

    def _index_of(self, node: Node) -> int:
        return next(i for i, item in enumerate(self._open) if item is node)

    def _parent_of(self, node: Node) -> Node:
        index = self._index_of(node)
        return self._open[index - 1] if index > 0 else self._root

    def _is_open(self, node: Node) -> bool:
        return any(item is node for item in self._open)

    def _scope(self) -> Node:
        for node in reversed(self._open):
            if self._m(node).scope:
                return node
        return self._root

    def _scope_of(self, node: Node) -> Node:
        """Nearest numbering scope at or above an open *node*."""
        below = False
        for item in reversed(self._open):
            below = below or item is node
            if below and self._m(item).scope:
                return item
        return self._root

    def _container(self) -> Node:
        for node in reversed(self._open):
            if self._m(node).container:
                return node
        return self._root

    def _active_anchor(self, *, text_may_own: bool = True) -> tuple[Node, int]:
        """Deepest open node that can own a list or table starting here.

        Bullets, plain paragraphs and title lines do not own what follows
        unless a paragraph introduces it with a colon (and even then it
        never owns numbered sections: *text_may_own* is False for them).
        """
        index = len(self._open) - 1
        while index > 0:
            node = self._open[index]
            if node.kind == NodeKind.HEADING and not self._m(node).container:
                index -= 1
                continue
            passive = node.kind in (NodeKind.BULLET, NodeKind.PARAGRAPH)
            if passive and not (text_may_own and self._introduces(node)):
                index -= 1
                continue
            break
        return self._open[index], index

    def _top_level_in_scope(self, parent: Node) -> bool:
        """No numbered ancestor between *parent* and its scope."""
        below = False
        for item in reversed(self._open):
            below = below or item is parent
            if not below:
                continue
            meta = self._m(item)
            if meta.scope:
                return True
            if meta.abs_path is not None:
                return False
        return True

    def _warn(
        self,
        node: Node | None,
        code: str,
        message: str,
        severity: str = "warning",
    ) -> None:
        if node is not None:
            node.warnings.append(message)
        self._issues.append(
            Issue(
                code=code,
                severity=severity,
                message=message,
                node_id=node.id if node is not None else None,
            )
        )

    def _new_id(self) -> str:
        self._counter += 1
        return f"n{self._counter}"

    def _node(
        self,
        kind: NodeKind,
        paragraph: Paragraph,
        *,
        label: Label | None = None,
        text: str = "",
    ) -> Node:
        node = Node(
            id=self._new_id(),
            kind=kind,
            label=label.raw if label else "",
            text=text,
            order=paragraph.index,
            page=paragraph.page,
            blocks=[paragraph.index],
        )
        self._meta[node.id] = _Meta(label=label, indent=paragraph.indent)
        self._touched = node
        return node

    def _attach(
        self, parent: Node, node: Node, *, keep_open: bool = True
    ) -> None:
        while self._open[-1] is not parent:
            self._open.pop()
        parent.children.append(node)
        if keep_open:
            self._open.append(node)
        is_title = (
            node.kind == NodeKind.HEADING and not self._m(node).container
        )
        if not is_title:
            self._before_content = False

    def _append_text(
        self, node: Node, paragraph: Paragraph, text: str
    ) -> None:
        broken = (
            bool(node.text)
            and not node.text.rstrip().endswith((*_TERMINAL, ":", ","))
            and text[:1].islower()
        )
        joiner = " " if broken else "\n"
        node.text = f"{node.text}{joiner}{text}" if node.text else text
        node.blocks.append(paragraph.index)
        self._touched = node

    @staticmethod
    def _complete(node: Node) -> bool:
        return node.text.rstrip(' »")').endswith(_TERMINAL)

    @staticmethod
    def _introduces(node: Node) -> bool:
        return node.text.rstrip().endswith(":")

    # ---- numbering sequence helpers --------------------------------

    @staticmethod
    def _sig(label: Label) -> tuple:
        """Identity of the list a mark belongs to."""
        if label.auto:
            return ("auto", label.list_id, label.level)
        if label.kind == LabelKind.DECIMAL:
            return ("dec",)
        if label.kind == LabelKind.LETTER:
            return ("let", label.script.split("-")[-1])
        if label.kind == LabelKind.ROMAN:
            return ("rom", label.script)
        return ("word", label.word)

    @staticmethod
    def _style(label: Label) -> tuple:
        return (label.kind, label.suffix, label.tab, label.auto)

    @staticmethod
    def _value(label: Label) -> object:
        if label.kind == LabelKind.LETTER and not label.auto:
            return label.raw.strip("().")
        return label.nums[-1] if label.nums else 0

    @staticmethod
    def _fit(label: Label, last: object) -> str:
        """How *label* continues a list whose last value is *last*."""
        if isinstance(last, str):
            previous, current = last, label.raw.strip("().")
            prev_info, cur_info = letter_info(previous), letter_info(current)
            if prev_info and cur_info and prev_info[0][:2] != cur_info[0][:2]:
                # "a)" typed in Latin inside a Cyrillic list
                previous, current = as_cyrillic(previous), as_cyrillic(current)
                prev_info = letter_info(previous)
                cur_info = letter_info(current)
            if not prev_info or not cur_info:
                return "back"
            if prev_info[0][:2] != cur_info[0][:2]:
                return "back"
            if prev_info[1] == cur_info[1]:
                return "dup"
            if letter_follows(prev_info[1], cur_info[1], prev_info[0]):
                return "next"
            return "gap" if cur_info[1] > prev_info[1] else "back"
        current = label.nums[-1]
        if current == last + 1:
            return "next"
        if current == last:
            return "dup"
        return "gap" if current > last else "back"

    @staticmethod
    def _is_first(label: Label) -> bool:
        if label.auto:
            return True
        if label.kind == LabelKind.LETTER:
            info = letter_info(as_cyrillic(label.raw.strip("().")))
            return bool(info) and info[1] == 1
        return bool(label.nums) and label.nums[-1] in (0, 1)

    def _record(
        self, parent: Node, node: Node, label: Label, sig: tuple
    ) -> None:
        meta = self._m(node)
        meta.sig = sig
        meta.style = self._style(label)
        value = self._value(label)
        scope_meta = self._m(self._scope_of(parent))
        self._m(parent).seqs[sig] = (value, meta.style)
        scope_meta.last_by_sig[sig] = value
        family = self._family(label)
        if family is not None:
            self._m(parent).seqs[family] = (value, meta.style)
            scope_meta.last_by_sig[family] = value
        if label.auto:
            self._auto_last[(label.list_id, label.level)] = node

    @staticmethod
    def _family(label: Label) -> tuple | None:
        """Shared key for "1." made by Word and "2." typed by hand.

        Real documents mix both in one list, so a typed number may
        continue an automatic one and vice versa.
        """
        if len(label.nums) != 1:
            return None
        if label.kind == LabelKind.DECIMAL:
            return ("family", "dec")
        if label.kind == LabelKind.ROMAN:
            return ("family", "rom", label.script)
        return None

    def _register_path(self, nums: tuple[int, ...]) -> None:
        scope_meta = self._m(self._scope())
        scope_meta.seen_paths.add(nums)
        scope_meta.virt_owner[nums[:-1]] = self._container().id
        for size in range(1, len(nums) + 1):
            prefix, value = nums[: size - 1], nums[size - 1]
            if size == len(nums) or value > scope_meta.virt.get(prefix, -1):
                scope_meta.virt[prefix] = value

    def _sequence_warning(
        self, node: Node, label: Label, fit: str, last: object
    ) -> None:
        number = label.raw
        if fit == "gap":
            self._warn(
                node,
                "numbering_gap",
                f"Перед п. {number} пропущены номера: предыдущий в этом "
                f"списке — {last}.",
            )
        elif fit == "dup":
            self._warn(
                node,
                "numbering_duplicate",
                f"Номер {number} встречается повторно.",
            )
        elif fit == "back":
            self._warn(
                node,
                "numbering_backward",
                f"Нумерация идёт назад: п. {number} стоит после п. {last}.",
            )

    # ---- main loop -------------------------------------------------

    def build(self) -> ExtractionResult:
        self._blocks = self._flatten(self._model.blocks)
        self._mark_contents()
        self._established_bare_paths = self._count_bare_paths() >= 3
        self._bold_is_emphasis = self._bold_share() < 0.8
        for position, block in enumerate(self._blocks):
            self._pos = position
            if isinstance(block, Table):
                self._table(block)
            else:
                has_text = bool(block.text.strip() or block.label)
                if self._caption is not None and has_text:
                    self._flush_caption()
                self._paragraph(block)
        if self._caption is not None:
            self._flush_caption()
        return self._finish()

    @staticmethod
    def _flatten(blocks: list) -> list:
        """Unwrap tables that only lay out ordinary text.

        One-column tables are frames; tables with the point number in a
        narrow first column (typical after PDF conversion) are the text
        itself, row by row.
        """
        result: list = []
        for block in blocks:
            if not isinstance(block, Table):
                result.append(block)
                continue
            if is_layout_table(block):
                for row in block.rows:
                    for cell in row.cells:
                        result.extend(cell.paragraphs)
                continue
            rows = layout_rows(block)
            if rows is None:
                result.append(block)
                continue
            for label, paragraphs in rows:
                filled = [p for p in paragraphs if p.text.strip() or p.label]
                if label and filled:
                    first = filled[0]
                    own_mark = first.label is not None or (
                        split_manual_label(first.text) is not None
                    )
                    if own_mark and label.strip("().") in _BULLET_CHARS:
                        pass  # a stray list mark next to a list of its own
                    elif own_mark:
                        # the cell opens with its own list: the number
                        # becomes a point of its own that holds the list
                        filled.insert(
                            0,
                            Paragraph(
                                index=first.index,
                                text="",
                                page=first.page,
                                forced_label=label,
                            ),
                        )
                    else:
                        filled[0] = replace(first, forced_label=label)
                result.extend(filled)
        return result

    def _contents_key(self, block) -> tuple | None:
        if isinstance(block, Table) or len(block.text) > 200:
            return None
        label = block.label
        if label is None:
            mark = split_manual_label(block.text)
            label = mark.label if mark is not None else None
        if label is None or label.kind == LabelKind.BULLET:
            return None
        return (label.kind, label.word, label.nums)

    def _mark_contents(self) -> None:
        """Skip a table of contents typed by hand.

        After a "СОДЕРЖАНИЕ" line the same section names are listed once
        and then repeated as the real headings; the list ends where the
        first name appears for the second time.
        """
        for start, block in enumerate(self._blocks):
            if isinstance(block, Table):
                continue
            title = _norm(block.text).lower().strip(" :.")
            if title not in _CONTENTS_TITLES:
                continue
            keys: list[tuple] = []
            entries: list[Paragraph] = []
            end = start + 1
            for end in range(start + 1, len(self._blocks)):
                entry = self._blocks[end]
                if not isinstance(entry, Table) and not entry.text.strip():
                    continue
                key = self._contents_key(entry)
                if key is None or key in keys:
                    break
                keys.append(key)
                entries.append(entry)
            later = {
                key
                for item in self._blocks[end:]
                if (key := self._contents_key(item)) is not None
            }
            if len(entries) < 2 or sum(k in later for k in keys) * 2 < len(
                keys
            ):
                continue
            block.is_toc = True
            for entry in entries:
                entry.is_toc = True
            self._contents_skipped += len(entries) + 1
            return

    def _bold_share(self) -> float:
        """Share of bold paragraphs: in an all-bold document bold text
        says nothing about headings."""
        texts = [
            block
            for block in self._blocks
            if not isinstance(block, Table) and block.text.strip()
        ]
        if not texts:
            return 0.0
        return sum(block.bold for block in texts) / len(texts)

    def _count_bare_paths(self) -> int:
        """How many paragraphs start with "1.1 Text" (no dot after it)."""
        count = 0
        for block in self._blocks:
            if isinstance(block, Table) or block.label is not None:
                continue
            mark = split_manual_label(block.text)
            if (
                mark is not None
                and mark.label.kind == LabelKind.DECIMAL
                and len(mark.label.nums) >= 2
                and not mark.label.suffix
            ):
                count += 1
        return count

    def _paragraph(self, paragraph: Paragraph) -> None:
        if paragraph.is_toc:
            return
        text = _norm(paragraph.text)
        label = paragraph.label
        rest = text
        weak = False
        forced = paragraph.forced_label
        if forced and label is None:
            # the number stands in its own table column: a tab after it
            # makes "8" or "8.1" an explicit mark
            source = paragraph.text
            if forced.strip("().") in _BULLET_CHARS:
                source = f"- {source}"
            else:
                source = f"{forced}\t{source}"
            mark = split_manual_label(source)
            if mark is not None and mark.label.kind != LabelKind.WORD:
                label, rest = mark.label, _norm(mark.rest)
            else:
                self._unknown_number(paragraph, forced, text)
                return
        elif label is None:
            mark = split_manual_label(paragraph.text)
            if mark is not None:
                label, rest, weak = mark.label, _norm(mark.rest), mark.weak
        if paragraph.has_image:
            self._image_pages.append(paragraph.page)
        if label is None and not text:
            return

        if label is None:
            self._unlabelled(paragraph, text)
            return
        if label.kind == LabelKind.BULLET:
            accepted = self._bullet(paragraph, label, rest)
        elif label.kind == LabelKind.WORD:
            accepted = self._word(paragraph, label, rest, text)
        elif label.kind == LabelKind.DECIMAL and len(label.nums) >= 2:
            accepted = self._decimal_path(paragraph, label, rest)
        else:
            accepted = self._single(paragraph, label, rest, weak)
        if not accepted:
            self._unlabelled(paragraph, text)
        elif forced and self._touched is self._open[-1]:
            # remember where points numbered in the table column live
            self._column_parent = self._parent_of(self._open[-1])

    def _unknown_number(
        self, paragraph: Paragraph, forced: str, text: str
    ) -> None:
        """Point whose number cell holds something that is not a number.

        It is kept with the mark exactly as written, next to the other
        numbered points, and flagged for the customer.
        """
        parent = self._column_parent
        if parent is None or not self._is_open(parent):
            parent = self._container()
        node = self._node(NodeKind.ITEM, paragraph, text=text)
        node.label = forced
        self._attach(parent, node)
        self._warn(
            node,
            "unknown_number",
            f"Номер «{forced}» не распознан: проверьте его по документу.",
        )

    def _unlabelled(self, paragraph: Paragraph, text: str) -> None:
        if not text:
            return
        if paragraph.heading_level is not None:
            self._heading(paragraph, text, paragraph.heading_level)
        elif paragraph.is_title:
            self._title(paragraph, text)
        elif self._looks_like_heading(paragraph, text):
            if self._before_content:
                self._title(paragraph, text)
            else:
                self._heading(paragraph, text, _HEURISTIC_LEVEL)
        else:
            self._plain(paragraph, text)

    def _looks_like_heading(self, paragraph: Paragraph, text: str) -> bool:
        if "\n" in text or len(text) > 150:
            return False
        if not any(char.isalpha() for char in text):
            return False
        if text.endswith((".", ";", ",")):
            return False
        if text[:1].islower() and not self._before_content:
            # a line that starts in lower case continues the text above
            return False
        if paragraph.caps or (paragraph.bold and self._bold_is_emphasis):
            return True
        return paragraph.align == "center" and len(text) <= 120

    def _item_is_heading(self, paragraph: Paragraph, rest: str) -> bool:
        if paragraph.heading_level is not None:
            return True
        return bool(rest) and self._looks_like_heading(paragraph, rest)

    # ---- unnumbered text -------------------------------------------

    def _plain(self, paragraph: Paragraph, text: str) -> None:
        last = self._open[-1]
        if last.kind == NodeKind.ITEM:
            broken_line = (
                text[:1].islower()
                and bool(last.text)
                and not last.text.rstrip().endswith((*_TERMINAL, ":"))
            )
            # "Краткое описание:" after a finished point opens new text
            # instead of continuing that point
            lead_in = text.endswith(":") and self._complete(last)
            owns_text = last.is_heading or self._introduces(last)
            glue = not last.children and (
                broken_line or (not owns_text and not lead_in)
            )
            if glue:
                self._append_text(last, paragraph, text)
                return
            parent = last
            if lead_in and not owns_text and not last.children:
                parent = self._parent_of(last)
        elif last.kind == NodeKind.BULLET:
            if not self._complete(last) or text[:1].islower():
                self._append_text(last, paragraph, text)
                return
            parent = self._parent_of(last)
        elif last.kind == NodeKind.PARAGRAPH:
            if not self._complete(last) and text[:1].islower():
                self._append_text(last, paragraph, text)
                return
            parent = self._parent_of(last)
        elif self._m(last).container:
            parent = last
        else:
            parent = self._parent_of(last)
        node = self._node(NodeKind.PARAGRAPH, paragraph, text=text)
        self._attach(parent, node)

    def _title(self, paragraph: Paragraph, text: str) -> None:
        """Title line of the document: a heading that owns nothing."""
        last = self._open[-1]
        if (
            last.kind == NodeKind.HEADING
            and not self._m(last).container
            and self._touched is last
        ):
            self._append_text(last, paragraph, text)
            return
        node = self._node(NodeKind.HEADING, paragraph, text=text)
        node.is_heading = True
        self._attach(self._scope(), node)

    def _heading(self, paragraph: Paragraph, text: str, level: int) -> None:
        parent = self._heading_parent(level)
        node = self._node(NodeKind.HEADING, paragraph, text=text)
        node.is_heading = True
        node_meta = self._m(node)
        node_meta.container = True
        node_meta.heading_level = level
        self._attach(parent, node)

    def _heading_parent(self, level: int) -> Node:
        for node in reversed(self._open):
            meta = self._m(node)
            if meta.scope:
                return node
            if meta.heading_level is not None and meta.heading_level < level:
                return node
            if (
                level == _HEURISTIC_LEVEL
                and node.kind == NodeKind.ITEM
                and meta.abs_path is not None
                and (node.children or node.is_heading)
            ):
                # a bold line inside a numbered section stays inside it
                return node
        return self._root

    # ---- numbered points -------------------------------------------

    def _item(self, paragraph: Paragraph, label: Label, rest: str) -> Node:
        node = self._node(NodeKind.ITEM, paragraph, label=label, text=rest)
        node.is_heading = self._item_is_heading(paragraph, rest)
        if paragraph.heading_level is not None:
            self._m(node).heading_level = paragraph.heading_level
        return node

    def _find_open_abs(self, path: tuple[int, ...]) -> Node | None:
        for node in reversed(self._open):
            meta = self._m(node)
            if meta.abs_path == path:
                return node
            if meta.scope:
                break
        return None

    def _auto_parent(self, label: Label) -> Node | None:
        for level in range(label.level - 1, -1, -1):
            node = self._auto_last.get((label.list_id, level))
            if node is not None and self._is_open(node):
                return node
        return None

    @staticmethod
    def _path_text(prefix: tuple[int, ...], value: object) -> str:
        return ".".join(str(part) for part in (*prefix, value))

    @staticmethod
    def _parent_is_odd(prefix: tuple[int, ...], scope_meta: _Meta) -> bool:
        """The absent parent does not continue the numbering either."""
        last = scope_meta.virt.get(prefix[:-1])
        if last is None:
            return prefix[-1] not in (0, 1)
        return prefix[-1] not in (last, last + 1)

    def _accept_path(
        self,
        label: Label,
        fit: str,
        last: object,
        parent_known: bool,
        scope_meta: _Meta,
    ) -> bool:
        """Decide whether typed "4.2 ..." is a number or ordinary text."""
        explicit = (
            bool(label.suffix) or label.tab or self._established_bare_paths
        )
        current = label.nums[-1]
        if parent_known:
            if fit in ("first", "next"):
                return True
            if fit == "gap":
                jump = current - (last if isinstance(last, int) else 0)
                return explicit or jump <= 5
            return explicit
        if not scope_meta.virt:
            # the document (or appendix) may start in the middle: "3.1 ..."
            return explicit or current in (0, 1)
        if fit in ("first", "next") and not self._parent_is_odd(
            label.nums[:-1], scope_meta
        ):
            return True
        return explicit

    def _decimal_path(
        self, paragraph: Paragraph, label: Label, rest: str
    ) -> bool:
        """Point numbered like 4.2.1: the prefix names its parent."""
        nums = label.nums
        prefix, current = nums[:-1], nums[-1]
        scope_meta = self._m(self._scope())
        parent = self._auto_parent(label) if label.auto else None
        if parent is None:
            parent = self._find_open_abs(prefix)
        if parent is not None:
            seq = self._m(parent).seqs.get(_DEC_PATH)
            last = seq[0] if seq else None
        else:
            last = scope_meta.virt.get(prefix)
            owner = scope_meta.virt_owner.get(prefix)
            restarted = (
                last is not None
                and current <= last
                and owner is not None
                and owner != self._container().id
            )
            if restarted:
                # the same numbers start again under a new heading
                for store in (scope_meta.virt, scope_meta.virt_owner):
                    for key in [
                        k for k in store if k[: len(prefix)] == prefix
                    ]:
                        del store[key]
                scope_meta.seen_paths = {
                    path
                    for path in scope_meta.seen_paths
                    if path[: len(prefix)] != prefix
                }
                last = None
        if last is None:
            fit = "first" if current in (0, 1) else "gap"
        else:
            fit = self._fit(label, last)
        scope_was_empty = not scope_meta.virt
        parent_known = parent is not None or prefix in scope_meta.seen_paths
        if not label.auto and not self._accept_path(
            label, fit, last, parent_known, scope_meta
        ):
            return False

        target = parent
        missing = False
        if target is None:
            for size in range(len(prefix) - 1, 0, -1):
                target = self._find_open_abs(prefix[:size])
                if target is not None:
                    break
            missing = prefix not in scope_meta.seen_paths
            if target is None:
                target = self._container()

        node = self._item(paragraph, label, rest)
        self._attach(target, node)
        self._m(node).abs_path = nums
        self._record(target, node, label, _DEC_PATH)
        if parent is None:
            # siblings here have different prefixes: no shared sequence
            self._m(target).seqs.pop(_DEC_PATH, None)

        if fit in ("gap", "dup", "back") and last is not None:
            self._sequence_warning(
                node, label, fit, self._path_text(prefix, last)
            )
        elif fit == "gap" and parent_known:
            self._warn(
                node,
                "numbering_starts_from",
                f"Подпункты начинаются с п. {label.raw}, а не с первого.",
            )
        elif scope_was_empty and (nums[0] > 1 or current > 1):
            self._warn(
                node,
                "numbering_starts_from",
                f"Нумерация начинается с п. {label.raw}, а не с первого.",
                severity="info",
            )
        same_depth_exists = any(
            len(path) == len(prefix) for path in scope_meta.seen_paths
        )
        if (
            missing
            and same_depth_exists
            and prefix not in self._missing_parents
        ):
            self._missing_parents.add(prefix)
            absent = self._path_text(prefix[:-1], prefix[-1])
            self._warn(
                node,
                "missing_parent",
                f"В документе нет п. {absent}, к которому относится "
                f"п. {label.raw}.",
            )
        self._register_path(nums)
        return True

    def _single(
        self, paragraph: Paragraph, label: Label, rest: str, weak: bool
    ) -> bool:
        """Point with a one-part mark: "5.", "а)", "IV." or a list level."""
        sig = self._sig(label)
        style = self._style(label)

        if label.auto and label.level > 0:
            parent = self._auto_parent(label)
            if parent is not None:
                node = self._item(paragraph, label, rest)
                self._attach(parent, node)
                self._record(parent, node, label, sig)
                return True

        family = self._family(label)

        def open_lists(key: tuple | None) -> list:
            found: list[tuple[Node, str, object, tuple | None]] = []
            if key is None:
                return found
            for node in reversed(self._open):
                meta = self._m(node)
                seq = meta.seqs.get(key)
                if seq is not None:
                    found.append((node, self._fit(label, seq[0]), *seq))
                if meta.scope:
                    break
            return found

        candidates = open_lists(sig)
        nexts = [item for item in candidates if item[1] == "next"]
        if weak and label.kind == LabelKind.DECIMAL:
            # "1 Сведения": no dot after the number — accept only as part
            # of a list written the same way or when 1.1, 1.2 follow
            same_style = any(item[3] == style for item in nexts)
            if not same_style and not self._subpoints_ahead(label):
                return False
            weak = False
        if not nexts:
            # a typed number continuing an automatic list, or vice versa
            relatives = open_lists(family)
            nexts = [item for item in relatives if item[1] == "next"]
            if not candidates:
                candidates = relatives
        if nexts:
            chosen = next(
                (item for item in nexts if item[3] == style), nexts[0]
            )
            self._add_single(paragraph, label, rest, chosen[0], sig)
            return True

        scope_meta = self._m(self._scope())
        closed_last = scope_meta.last_by_sig.get(sig)
        if closed_last is None and family is not None:
            closed_last = scope_meta.last_by_sig.get(family)
        if (
            closed_last is not None
            and not candidates
            and self._fit(label, closed_last) == "next"
        ):
            # the list goes on after a heading that closed its parent
            self._add_single(paragraph, label, rest, self._container(), sig)
            return True

        first = self._is_first(label)
        if weak and not (first and self._confirmed_ahead(label)):
            return False
        if first:
            parent, restarted = self._parent_for_new_list(
                paragraph, label, sig, style
            )
            node = self._add_single(paragraph, label, rest, parent, sig)
            if restarted:
                self._warn(
                    node,
                    "numbering_restart",
                    f"Нумерация начата заново с п. {label.raw} без нового "
                    "раздела: номера в документе повторяются.",
                )
            return True

        soft = [item for item in candidates if item[1] in ("gap", "dup")]
        if soft:
            parent, fit, last, _style = soft[0]
            node = self._add_single(paragraph, label, rest, parent, sig)
            self._sequence_warning(node, label, fit, last)
            return True
        if closed_last is not None and not candidates:
            fit = self._fit(label, closed_last)
            if fit in ("gap", "dup"):
                node = self._add_single(
                    paragraph, label, rest, self._container(), sig
                )
                self._sequence_warning(node, label, fit, closed_last)
                return True
        if candidates:
            # the number goes backwards: keep it where the list lives
            parent, fit, last, _style = candidates[0]
            node = self._add_single(paragraph, label, rest, parent, sig)
            self._sequence_warning(node, label, fit, last)
            return True
        parent, _restarted = self._parent_for_new_list(
            paragraph, label, sig, style
        )
        node = self._add_single(paragraph, label, rest, parent, sig)
        self._warn(
            node,
            "numbering_starts_from",
            f"Нумерация начинается с п. {label.raw}, а не с первого.",
        )
        return True

    def _add_single(
        self,
        paragraph: Paragraph,
        label: Label,
        rest: str,
        parent: Node,
        sig: tuple,
    ) -> Node:
        node = self._item(paragraph, label, rest)
        self._attach(parent, node)
        self._record(parent, node, label, sig)
        numeric = label.kind in (LabelKind.DECIMAL, LabelKind.ROMAN)
        if (
            numeric
            and len(label.nums) == 1
            and self._m(parent).container
            and self._top_level_in_scope(parent)
        ):
            # "5." at the top of a scope is the parent of "5.1", "5.2"...
            self._m(node).abs_path = label.nums
            self._register_path(label.nums)
        return node

    def _subpoints_ahead(self, label: Label) -> bool:
        """Points "N.1", "N.2" follow a bare number "N" within a few lines."""
        seen = 0
        for block in self._blocks[self._pos + 1 :]:
            if isinstance(block, Table):
                return False
            if not (block.text.strip() or block.label):
                continue
            seen += 1
            mark_label = block.label
            if mark_label is None:
                mark = split_manual_label(block.text)
                mark_label = mark.label if mark is not None else None
            if (
                mark_label is not None
                and mark_label.kind == LabelKind.DECIMAL
                and len(mark_label.nums) >= 2
                and mark_label.nums[:-1] == label.nums
            ):
                return True
            if seen >= 4:
                return False
        return False

    def _parent_for_new_list(
        self, paragraph: Paragraph, label: Label, sig: tuple, style: tuple
    ) -> tuple[Node, bool]:
        """Where a list that starts here hangs; True if it is a restart."""
        # "1." / "I." after a lead-in paragraph is a new section, while
        # "1)" and "а)" are its enumeration
        enumeration = label.kind == LabelKind.LETTER or label.suffix == ")"
        anchor, index = self._active_anchor(text_may_own=enumeration)
        meta = self._m(anchor)
        if meta.container or anchor.kind != NodeKind.ITEM:
            return anchor, False
        same_list = meta.sig == sig and meta.style == style
        deeper = paragraph.indent > meta.indent + _INDENT_STEP
        if not same_list or self._introduces(anchor) or deeper:
            return anchor, False
        owner = self._open[index - 1] if index > 0 else self._root
        return owner, True

    def _confirmed_ahead(self, label: Label) -> bool:
        """A weak mark such as "А." counts only if "Б." follows nearby."""
        value = self._value(label)
        limit = min(len(self._blocks), self._pos + 1 + _LOOKAHEAD_BLOCKS)
        for block in self._blocks[self._pos + 1 : limit]:
            if isinstance(block, Table) or block.label is not None:
                continue
            mark = split_manual_label(block.text)
            if mark is None or mark.label.kind != label.kind:
                continue
            if mark.label.suffix != label.suffix:
                continue
            if self._fit(mark.label, value) == "next":
                return True
        return False

    # ---- bullets ---------------------------------------------------

    def _bullet(self, paragraph: Paragraph, label: Label, rest: str) -> bool:
        key = ("bul", label.list_id, label.level if label.auto else 0)
        parent: Node | None = None
        for index in range(len(self._open) - 1, 0, -1):
            node = self._open[index]
            if node.kind != NodeKind.BULLET:
                break
            meta = self._m(node)
            if meta.sig == key:
                parent = self._open[index - 1]
                break
            other = meta.label
            if (
                label.auto
                and other is not None
                and other.auto
                and other.list_id == label.list_id
                and label.level > other.level
            ):
                parent = node
                break
        if parent is None:
            anchor = self._open[-1]
            if anchor.kind == NodeKind.BULLET:
                deeper = (
                    paragraph.indent > self._m(anchor).indent + _INDENT_STEP
                )
                parent = anchor if deeper else self._parent_of(anchor)
            else:
                parent, _index = self._active_anchor()
        node = self._node(NodeKind.BULLET, paragraph, label=label, text=rest)
        self._attach(parent, node)
        self._m(node).sig = key
        return True

    # ---- sections: Приложение / Раздел / Лот -----------------------

    def _word(
        self, paragraph: Paragraph, label: Label, rest: str, text: str
    ) -> bool:
        heading_like = (
            label.auto
            or paragraph.heading_level is not None
            or (paragraph.bold and self._bold_is_emphasis)
            or paragraph.caps
            or paragraph.align in ("center", "right")
            or len(text) <= 60
            or (len(text) <= 120 and not text.endswith((".", ";", ",")))
        )
        if not heading_like:
            return False
        if label.word == "таблица":
            self._caption = (paragraph, label, rest)
            return True

        sig = self._sig(label)
        is_scope = label.word in SCOPE_WORDS
        parent: Node | None = None
        fit = ""
        last: object = None
        for node in reversed(self._open):
            seq = self._m(node).seqs.get(sig)
            if seq is not None:
                parent, last = node, seq[0]
                fit = self._fit(label, last)
                break
        if parent is None:
            if label.word == "приложение":
                parent = self._root
            elif is_scope:
                parent = self._scope()
            else:
                parent = self._container()

        node = self._node(NodeKind.SECTION, paragraph, label=label, text=rest)
        node.is_heading = True
        meta = self._m(node)
        meta.container = True
        # numbering usually starts again inside every section, so each
        # one keeps its own memory of numbers
        meta.scope = True
        meta.heading_level = paragraph.heading_level or 0
        self._attach(parent, node)
        self._m(parent).seqs[sig] = (self._value(label), self._style(label))
        if label.auto:
            self._auto_last[(label.list_id, label.level)] = node
        if not is_scope and label.nums:
            # "Раздел 2" is the parent of points 2.1, 2.2 ...
            meta.abs_path = label.nums
            self._register_path(label.nums)
        if fit in ("gap", "dup", "back"):
            self._sequence_warning(node, label, fit, f"{label.word} {last}")
        return True

    # ---- tables ----------------------------------------------------

    def _flush_caption(self) -> None:
        """A "Таблица N" line that no table followed is ordinary text."""
        paragraph, _label, _rest = self._caption
        self._caption = None
        text = _norm(paragraph.text)
        if self._looks_like_heading(paragraph, text):
            self._heading(paragraph, text, _HEURISTIC_LEVEL)
        else:
            self._plain(paragraph, text)

    def _table(self, table: Table) -> None:
        view = interpret_table(table)
        parent, _index = self._active_anchor()
        table_node = Node(
            id=self._new_id(),
            kind=NodeKind.TABLE,
            order=table.index,
            page=table.page,
            blocks=[table.index],
            columns=view.columns if view.has_header else None,
        )
        self._meta[table_node.id] = _Meta()
        if self._caption is not None:
            paragraph, label, rest = self._caption
            self._caption = None
            table_node.label = label.raw
            table_node.text = rest
            table_node.blocks.insert(0, paragraph.index)
            table_node.order = paragraph.index
            table_node.page = paragraph.page or table.page
        self._attach(parent, table_node, keep_open=False)
        self._touched = table_node
        self._fill_table(table_node, view)
        if view.nested_tables:
            self._warn(
                table_node,
                "nested_table",
                "В ячейках есть вложенные таблицы: их текст добавлен в "
                "ячейку построчно.",
                severity="info",
            )
        if not table_node.children:
            self._warn(
                table_node,
                "empty_table",
                "Таблица без строк с данными.",
                severity="info",
            )

    def _fill_table(self, table_node: Node, view: TableView) -> None:
        """Rows become points; numbers like 1.2 nest under row 1."""
        by_path: dict[tuple[int, ...], Node] = {}
        group: Node | None = None
        previous_row: Node | None = None
        last_flat: int | None = None
        seen_labels: set[str] = set()
        for row in view.rows:
            is_group = row.kind == "group"
            node = Node(
                id=self._new_id(),
                kind=NodeKind.TABLE_GROUP if is_group else NodeKind.TABLE_ROW,
                label=row.label,
                text=row.text,
                order=row.blocks[0] if row.blocks else table_node.order,
                page=row.page,
                blocks=list(row.blocks),
                cells=row.cells or None,
                is_heading=is_group,
            )
            self._meta[node.id] = _Meta()
            match = _TABLE_LABEL_RE.match(row.label) if row.label else None
            nums = (
                tuple(int(part) for part in match.group(1).split("."))
                if match
                else ()
            )
            parent = table_node
            if not is_group and group is not None:
                parent = group
            if row.sub_row and previous_row is not None:
                parent = previous_row
            elif len(nums) >= 2 and nums[:-1] in by_path:
                parent = by_path[nums[:-1]]
            parent.children.append(node)
            if nums:
                by_path = {
                    path: item
                    for path, item in by_path.items()
                    if len(path) < len(nums) and path == nums[: len(path)]
                }
                by_path[nums] = node
            if is_group:
                group = node
            elif not row.sub_row:
                previous_row = node
            if not row.label:
                continue
            if row.label in seen_labels:
                self._warn(
                    node,
                    "numbering_duplicate",
                    f"Номер {row.label} в таблице встречается повторно.",
                )
            seen_labels.add(row.label)
            if len(nums) == 1:
                if last_flat is not None and nums[0] > last_flat + 1:
                    self._warn(
                        node,
                        "numbering_gap",
                        f"В таблице перед строкой {row.label} пропущены "
                        f"номера: предыдущая — {last_flat}.",
                    )
                last_flat = nums[0]

    # ---- result ----------------------------------------------------

    def _drop_empty_items(self, parent: Node, dropped: list[str]) -> None:
        """Remove numbered lines that carry neither text nor content."""
        kept: list[Node] = []
        for child in parent.children:
            self._drop_empty_items(child, dropped)
            empty = (
                child.kind == NodeKind.ITEM
                and not child.text
                and not child.children
            )
            if empty:
                dropped.append(child.label)
            else:
                kept.append(child)
        parent.children = kept

    _INLINE_FIRST_RE = re.compile(r"^(.{15,}?\S)\s[-–—]\s([^\n]{8,};)$")

    def _split_inline_first_entry(self, node: Node) -> None:
        """Move "Title - first entry;" into the list that follows it.

        Authors often leave the first list entry on the title line; the
        rest of the list then starts on the next line.
        """
        for child in node.children:
            self._split_inline_first_entry(child)
        bullets = [c for c in node.children if c.kind == NodeKind.BULLET]
        if node.kind != NodeKind.ITEM or len(bullets) < 2:
            return
        if node.children[0].kind != NodeKind.BULLET:
            return
        match = self._INLINE_FIRST_RE.match(node.text)
        if match is None or not bullets[0].text.endswith(";"):
            return
        first = Node(
            id=self._new_id(),
            kind=NodeKind.BULLET,
            label=bullets[0].label,
            text=match.group(2),
            order=node.order,
            page=node.page,
            blocks=list(node.blocks),
        )
        self._meta[first.id] = _Meta()
        node.text = match.group(1)
        node.children.insert(0, first)

    def _assign_numbers(self, parent: Node, base: str) -> None:
        """Give every verifiable entry a number to compare offers against.

        Document numbers are kept. List entries the document leaves
        unnumbered get the next number inside their point: 20.1, 20.2 ...
        If the point already has its own sub-points 4.1, 4.2, the extra
        entries become "4 (1)", "4 (2)" so the two are never confused.
        """
        own_subpoints = any(
            child.kind == NodeKind.ITEM and self._m(child).abs_path is not None
            for child in parent.children
        )
        counter = 0
        for child in parent.children:
            meta = self._m(child)
            ref = ""
            if child.kind == NodeKind.ITEM:
                label = meta.label
                bare = child.label.rstrip(".)").lstrip("(")
                if meta.abs_path is not None or not base:
                    ref = bare
                elif label is not None and label.kind == LabelKind.LETTER:
                    ref = f"{base} {child.label}"
                else:
                    ref = f"{base}.{bare}"
                child.number = ref
                child.number_origin = "document"
            elif (
                child.kind
                in (NodeKind.BULLET, NodeKind.PARAGRAPH, NodeKind.HEADING)
                and base
            ):
                counter += 1
                ref = (
                    f"{base} ({counter})"
                    if own_subpoints
                    else f"{base}.{counter}"
                )
                child.number = ref
                child.number_origin = "system"
            if child.kind != NodeKind.TABLE:
                self._assign_numbers(child, ref)

    def _finish(self) -> ExtractionResult:
        stats = self._model.stats
        dropped: list[str] = []
        self._drop_empty_items(self._root, dropped)
        self._split_inline_first_entry(self._root)
        self._assign_numbers(self._root, "")
        nodes = self._root.children
        all_nodes = [item for node in nodes for item in node.walk()]
        numbered = [
            node
            for node in all_nodes
            if node.label
            and node.kind
            in (NodeKind.ITEM, NodeKind.TABLE_ROW, NodeKind.SECTION)
        ]
        doc_issues: list[Issue] = []

        def note(code: str, message: str, severity: str = "warning") -> None:
            doc_issues.append(
                Issue(code=code, severity=severity, message=message)
            )

        if not all_nodes:
            note("empty_document", "В документе не найден текст.")
        elif not numbered:
            note(
                "no_numbering",
                "В документе нет нумерации пунктов: структура построена по "
                "заголовкам и абзацам.",
            )
        if stats.images:
            pages = sorted({page for page in self._image_pages if page})
            where = (
                f" (стр. {', '.join(str(page) for page in pages[:8])})"
                if pages
                else ""
            )
            note(
                "images",
                f"В документе есть изображения: {stats.images}{where}. Текст "
                "на них не читается — проверьте, нет ли там требований.",
            )
        if stats.embedded_objects:
            note(
                "embedded_objects",
                "Вставленные объекты (например, таблица Excel): "
                f"{stats.embedded_objects}. Их содержимое не прочитано.",
            )
        if stats.tracked_insertions or stats.tracked_deletions:
            note(
                "tracked_changes",
                "В документе были исправления в режиме рецензирования: взят "
                f"итоговый текст (вставок: {stats.tracked_insertions}, "
                f"удалений: {stats.tracked_deletions}).",
            )
        if stats.textboxes:
            note(
                "textboxes",
                "Часть текста находится в надписях (рамках): "
                f"{stats.textboxes}. Они вынесены отдельными абзацами.",
                "info",
            )
        if stats.hidden_runs:
            note(
                "hidden_text",
                f"Скрытый текст пропущен (фрагментов: {stats.hidden_runs}).",
                "info",
            )
        if stats.broken_numbering_refs:
            note(
                "broken_numbering",
                f"У {stats.broken_numbering_refs} абзацев повреждена ссылка "
                "на список Word: их номера не восстановлены.",
            )
        if stats.footnotes:
            note(
                "footnotes",
                f"В документе есть сноски ({stats.footnotes}): их текст не "
                "включён.",
                "info",
            )
        if dropped:
            shown = ", ".join(f"«{label}»" for label in dropped[:10])
            note(
                "empty_items_skipped",
                "Пустые нумерованные строки пропущены "
                f"({len(dropped)}): {shown}",
                "info",
            )
        if self._contents_skipped:
            note(
                "contents_skipped",
                "Оглавление в начале документа пропущено "
                f"(строк: {self._contents_skipped}).",
                "info",
            )
        if stats.pages is None and all_nodes:
            note(
                "pages_unknown",
                "Номера страниц недоступны: в файле нет разметки страниц.",
                "info",
            )

        kinds: dict[str, int] = {}
        for node in all_nodes:
            kinds[node.kind.value] = kinds.get(node.kind.value, 0) + 1
        issues = [*doc_issues, *self._issues]
        summary = {
            "paragraphs_in_file": stats.paragraphs,
            "tables_in_file": stats.tables,
            "pages": stats.pages,
            "nodes": len(all_nodes),
            "numbered_points": len(numbered),
            "by_kind": kinds,
            "warnings": sum(issue.severity == "warning" for issue in issues),
            "toc_paragraphs_skipped": stats.toc_paragraphs,
        }
        return ExtractionResult(nodes=nodes, issues=issues, stats=summary)


def build_outline(model: DocModel) -> ExtractionResult:
    return OutlineBuilder(model).build()
