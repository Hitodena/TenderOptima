"""Small PNG preview of an attachment: first page of a PDF or a scaled image.

Previews are cached next to the uploads (``<upload_dir>/.thumbs``) under a key
built from the file path, its size and modification time and the width, so a
replaced file gets a new preview and nothing is rendered twice.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from loguru import logger

THUMB_DIR_NAME = ".thumbs"
MIN_WIDTH = 64
MAX_WIDTH = 800
# a hostile PDF must not hang a request worker
MAX_SOURCE_BYTES = 60 * 1024 * 1024

_PDF_EXT = {".pdf"}
_IMAGE_EXT = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
}


def can_preview(path: Path) -> bool:
    return path.suffix.lower() in _PDF_EXT | _IMAGE_EXT


def _cache_path(src: Path, cache_dir: Path, width: int) -> Path:
    stat = src.stat()
    key = f"{src.resolve()}|{stat.st_size}|{int(stat.st_mtime)}|{width}"
    return cache_dir / f"{hashlib.sha256(key.encode()).hexdigest()[:40]}.png"


def _render_pdf(src: Path, out: Path, width: int) -> None:
    import fitz  # PyMuPDF, already used for page counting

    with fitz.open(src) as doc:
        if doc.page_count == 0:
            raise ValueError("empty pdf")
        page = doc.load_page(0)
        zoom = width / max(page.rect.width, 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        pix.save(out)


def _render_image(src: Path, out: Path, width: int) -> None:
    from PIL import Image

    with Image.open(src) as img:
        img = img.convert("RGB")
        ratio = width / max(img.width, 1)
        if ratio < 1:
            img = img.resize((width, max(1, round(img.height * ratio))))
        img.save(out, format="PNG", optimize=True)


def make_thumbnail(
    src: Path, cache_dir: Path, width: int = 320
) -> Path | None:
    """Return the cached PNG preview, rendering it on first use.

    None when the file cannot be previewed (unsupported type, too large,
    broken file): the caller answers 404 and the page shows the file icon.
    """
    width = max(MIN_WIDTH, min(MAX_WIDTH, int(width)))
    if not src.is_file() or not can_preview(src):
        return None
    if src.stat().st_size > MAX_SOURCE_BYTES:
        return None
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = _cache_path(src, cache_dir, width)
    if out.is_file():
        return out
    tmp = out.with_suffix(".tmp.png")
    try:
        if src.suffix.lower() in _PDF_EXT:
            _render_pdf(src, tmp, width)
        else:
            _render_image(src, tmp, width)
        tmp.replace(out)
    except Exception as exc:
        logger.warning(
            "Attachment preview failed", path=str(src), error=str(exc)
        )
        tmp.unlink(missing_ok=True)
        return None
    return out
