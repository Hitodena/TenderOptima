"""PNG previews: PDF first page, images, cache, refusals."""

import os
import time

import fitz
from PIL import Image

from backend.utils import attachment_thumbnail as thumbs


def _pdf(path, pages=1):
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((72, 72), f"page {i + 1}")
    doc.save(path)
    doc.close()


def test_pdf_first_page_png(tmp_path):
    src = tmp_path / "kp.pdf"
    _pdf(src, pages=3)
    out = thumbs.make_thumbnail(src, tmp_path / ".thumbs", 320)
    assert out is not None and out.suffix == ".png"
    with Image.open(out) as img:
        assert img.width == 320
        assert img.height > img.width  # A4 portrait


def test_image_is_scaled_down_not_up(tmp_path):
    big = tmp_path / "photo.jpg"
    Image.new("RGB", (1600, 1200), "white").save(big)
    out = thumbs.make_thumbnail(big, tmp_path / ".thumbs", 320)
    with Image.open(out) as img:
        assert img.size == (320, 240)
    small = tmp_path / "icon.png"
    Image.new("RGB", (100, 50), "white").save(small)
    out = thumbs.make_thumbnail(small, tmp_path / ".thumbs", 320)
    with Image.open(out) as img:
        assert img.size == (100, 50)


def test_cache_reused_and_refreshed_on_change(tmp_path):
    src = tmp_path / "kp.pdf"
    _pdf(src)
    cache = tmp_path / ".thumbs"
    first = thumbs.make_thumbnail(src, cache, 320)
    assert thumbs.make_thumbnail(src, cache, 320) == first
    assert len(list(cache.glob("*.png"))) == 1
    # another width is another preview
    assert thumbs.make_thumbnail(src, cache, 160) != first
    # replaced file -> new preview
    time.sleep(1.1)
    _pdf(src, pages=2)
    os.utime(src)
    assert thumbs.make_thumbnail(src, cache, 320) != first


def test_width_is_clamped(tmp_path):
    src = tmp_path / "a.png"
    Image.new("RGB", (2000, 1000), "white").save(src)
    out = thumbs.make_thumbnail(src, tmp_path / ".thumbs", 5000)
    with Image.open(out) as img:
        assert img.width == thumbs.MAX_WIDTH
    out = thumbs.make_thumbnail(src, tmp_path / ".thumbs", 1)
    with Image.open(out) as img:
        assert img.width == thumbs.MIN_WIDTH


def test_unsupported_missing_broken_and_too_big(tmp_path, monkeypatch):
    cache = tmp_path / ".thumbs"
    xlsx = tmp_path / "price.xlsx"
    xlsx.write_bytes(b"PK")
    assert thumbs.make_thumbnail(xlsx, cache) is None
    assert thumbs.make_thumbnail(tmp_path / "nope.pdf", cache) is None
    broken = tmp_path / "broken.pdf"
    broken.write_bytes(b"not a pdf at all")
    assert thumbs.make_thumbnail(broken, cache) is None
    assert not list(cache.glob("*.tmp.png"))  # no half-written files left
    ok = tmp_path / "ok.pdf"
    _pdf(ok)
    monkeypatch.setattr(thumbs, "MAX_SOURCE_BYTES", 10)
    assert thumbs.make_thumbnail(ok, cache) is None


def test_uppercase_extension(tmp_path):
    src = tmp_path / "SCAN.PDF"
    _pdf(src)
    assert thumbs.make_thumbnail(src, tmp_path / ".thumbs") is not None
