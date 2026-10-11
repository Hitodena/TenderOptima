"""Run the extraction on one file and write result.json / report.html.

Usage: python -m backend.services.tz_structure FILE.docx [--out DIR]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from backend.services.tz_structure import DocxReadError, extract_structure
from backend.services.tz_structure.render import outline_text, report_html


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tz_structure")
    parser.add_argument("file", type=Path)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args(argv)
    try:
        result = extract_structure(args.file)
    except DocxReadError as exc:
        print(f"Не удалось прочитать файл: {exc.message}", file=sys.stderr)
        return 2
    out = args.out or args.file.with_suffix("")
    out.mkdir(parents=True, exist_ok=True)
    (out / "result.json").write_text(
        json.dumps(result.to_dict(), ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    (out / "outline.txt").write_text(outline_text(result), encoding="utf-8")
    (out / "report.html").write_text(
        report_html(result, title=args.file.name), encoding="utf-8"
    )
    print(json.dumps(result.stats, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
