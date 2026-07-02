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
        "pdf",
        "--outdir",
        str(output_dir),
        str(docx_path),
    ]


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
        output_dir = Path(temp_dir)
        profile_dir = output_dir / "lo_profile"
        profile_dir.mkdir()
        command = build_soffice_command(
            soffice,
            output_dir=output_dir,
            docx_path=docx_path,
            profile_dir=profile_dir,
        )
        env = {
            **os.environ,
            "HOME": str(output_dir),
            "TMPDIR": str(output_dir),
            "SAL_USE_VCLPLUGIN": "gen",
        }
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
                env=env,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.warning(
                "DOCX to PDF conversion failed",
                path=str(docx_path),
                error=str(exc),
            )
            return None

        if result.returncode != 0:
            logger.warning(
                "DOCX to PDF conversion failed",
                path=str(docx_path),
                returncode=result.returncode,
                stderr=(result.stderr or "").strip()[:500],
            )
            return None

        expected = output_dir / f"{docx_path.stem}.pdf"
        if not expected.is_file():
            pdf_files = sorted(output_dir.glob("*.pdf"))
            if not pdf_files:
                logger.warning(
                    "DOCX to PDF conversion produced no output",
                    path=str(docx_path),
                )
                return None
            expected = pdf_files[0]

        persistent_dir = Path(tempfile.mkdtemp(prefix="docx_pdf_"))
        destination = persistent_dir / expected.name
        shutil.copy2(expected, destination)
        return destination
