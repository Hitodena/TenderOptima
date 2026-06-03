import shutil
import uuid
from pathlib import Path

from backend.core import get_config


def tz_analysis_dir(analysis_id: uuid.UUID) -> Path:
    return Path(get_config().upload_dir) / "tz_analyses" / str(analysis_id)


def save_tz_analysis_files(
    analysis_id: uuid.UUID,
    tz_path: Path,
    kp_path: Path,
) -> tuple[Path, Path]:
    """Copy uploaded files into upload_dir for background processing."""
    dest = tz_analysis_dir(analysis_id)
    dest.mkdir(parents=True, exist_ok=True)

    tz_dest = dest / f"tz{tz_path.suffix.lower()}"
    kp_dest = dest / f"kp{kp_path.suffix.lower()}"

    shutil.copy2(tz_path, tz_dest)
    shutil.copy2(kp_path, kp_dest)

    return tz_dest, kp_dest


def resolve_tz_analysis_files(
    analysis_id: uuid.UUID,
) -> tuple[Path, Path] | None:
    """Return TZ and KP paths if both exist in the analysis directory."""
    dest = tz_analysis_dir(analysis_id)

    if not dest.is_dir():
        return None

    tz_files = sorted(dest.glob("tz*"))
    kp_files = sorted(dest.glob("kp*"))

    if not tz_files or not kp_files:
        return None

    return tz_files[0], kp_files[0]
