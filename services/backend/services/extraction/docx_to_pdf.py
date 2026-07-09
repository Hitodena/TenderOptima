"""Convert DOCX files to PDF for page-aware text extraction."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from loguru import logger

_SOFFICE_CANDIDATES = (
    "soffice",
    "libreoffice",
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
)
_INPUT_NAME = "source.docx"
_OUTPUT_STEM = "source"


def find_soffice_executable() -> str | None:
    """Return the first available LibreOffice/soffice binary."""
    for candidate in _SOFFICE_CANDIDATES:
        if Path(candidate).is_file():
            return candidate
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def build_soffice_command(
    soffice: str,
    *,
    output_dir: Path,
    docx_path: Path,
    profile_dir: Path,
) -> list[str]:
    """Build a headless LibreOffice command with an isolated user profile."""
    return [
        soffice,
        f"-env:UserInstallation={profile_dir.resolve().as_uri()}",
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf:writer_pdf_Export",
        "--outdir",
        str(output_dir.resolve()),
        str(docx_path.resolve()),
    ]


def find_converted_pdf(
    output_dir: Path, *, stem: str = _OUTPUT_STEM
) -> Path | None:
    """Locate a PDF produced by LibreOffice under *output_dir*."""
    candidates = [
        path
        for path in output_dir.rglob("*.pdf")
        if "lo_profile" not in path.parts
    ]
    if not candidates:
        return None

    exact = [path for path in candidates if path.stem == stem]
    if exact:
        return sorted(exact)[0]
    return sorted(candidates)[0]


def convert_docx_to_pdf(docx_path: Path) -> Path | None:
    """Render *docx_path* to PDF and return the output path.

    Returns ``None`` when LibreOffice is unavailable or conversion fails.
    """
    if not docx_path.is_file():
        return None

    soffice = find_soffice_executable()
    if not soffice:
        logger.warning(
            "DOCX to PDF conversion skipped",
            reason="libreoffice_not_found",
            path=str(docx_path),
        )
        return None

    with tempfile.TemporaryDirectory(prefix="docx2pdf_") as temp_dir:
        work_dir = Path(temp_dir).resolve()
        profile_dir = work_dir / "lo_profile"
        profile_dir.mkdir()
        input_copy = work_dir / _INPUT_NAME
        shutil.copy2(docx_path, input_copy)
        output_dir = work_dir / "pdf_out"
        output_dir.mkdir()

        command = build_soffice_command(
            soffice,
            output_dir=output_dir,
            docx_path=input_copy,
            profile_dir=profile_dir,
        )
        env = {
            **os.environ,
            "HOME": str(work_dir),
            "TMPDIR": str(work_dir),
            "SAL_USE_VCLPLUGIN": os.environ.get("SAL_USE_VCLPLUGIN", "svp"),
            "SAL_DISABLE_OPENCL": "1",
        }
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
                env=env,
                cwd=str(work_dir),
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.warning(
                "DOCX to PDF conversion failed",
                path=str(docx_path),
                error=str(exc),
            )
            return None

        pdf_path = find_converted_pdf(output_dir)
        if pdf_path is None:
            pdf_path = find_converted_pdf(work_dir)

        if result.returncode != 0 or pdf_path is None:
            logger.warning(
                "DOCX to PDF conversion failed",
                path=str(docx_path),
                returncode=result.returncode,
                stdout=(result.stdout or "").strip()[:500],
                stderr=(result.stderr or "").strip()[:500],
                work_dir=str(work_dir),
            )
            return None

        persistent_dir = Path(tempfile.mkdtemp(prefix="docx_pdf_"))
        destination = persistent_dir / pdf_path.name
        shutil.copy2(pdf_path, destination)
        return destination
