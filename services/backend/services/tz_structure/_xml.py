"""WordprocessingML namespaces and small XML helpers."""

from __future__ import annotations

from lxml import etree

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
MC_NS = "http://schemas.openxmlformats.org/markup-compatibility/2006"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
V_NS = "urn:schemas-microsoft-com:vml"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

# ISO "Strict" documents use other namespace URIs for the same vocabulary.
STRICT_REPLACEMENTS = (
    (
        b"http://purl.oclc.org/ooxml/wordprocessingml/main",
        W_NS.encode(),
    ),
    (
        b"http://purl.oclc.org/ooxml/officeDocument/math",
        M_NS.encode(),
    ),
    (
        b"http://purl.oclc.org/ooxml/drawingml/main",
        A_NS.encode(),
    ),
    (
        b"http://purl.oclc.org/ooxml/officeDocument/relationships",
        b"http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    ),
)


def w(tag: str) -> str:
    return f"{{{W_NS}}}{tag}"


def mc(tag: str) -> str:
    return f"{{{MC_NS}}}{tag}"


def m(tag: str) -> str:
    return f"{{{M_NS}}}{tag}"


W_VAL = w("val")


def val(element, tag: str) -> str | None:
    """Return ``w:val`` of the direct child ``w:<tag>`` or ``None``."""
    if element is None:
        return None
    child = element.find(w(tag))
    if child is None:
        return None
    return child.get(W_VAL)


def is_on(element) -> bool:
    """Evaluate a WordprocessingML on/off property element."""
    if element is None:
        return False
    value = element.get(W_VAL)
    return value not in ("0", "false", "off")


def flag(element, tag: str) -> bool | None:
    """Tri-state on/off child: ``None`` when the property is absent."""
    if element is None:
        return None
    child = element.find(w(tag))
    if child is None:
        return None
    return is_on(child)


def to_int(value: str | None, default: int | None = None) -> int | None:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        try:
            return int(float(value))
        except ValueError:
            return default


def parse_xml(data: bytes):
    """Parse an OOXML part without entity expansion or network access."""
    for strict, transitional in STRICT_REPLACEMENTS:
        if strict in data:
            data = data.replace(strict, transitional)
    parser = etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        remove_comments=True,
        remove_pis=True,
    )
    return etree.fromstring(data, parser)
