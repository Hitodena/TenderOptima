import shutil
import uuid
from pathlib import Path

from backend.core import get_config


def tz_analysis_dir(analysis_id: uuid.UUID) -> Path:
    return Path(get_config().upload_dir) / "tz_analyses" / str(analysis_id)


def make_unique_filenames(filenames: list[str]) -> list[str]:
    """Ensure display names are unique when users upload files with the same name."""
    used: set[str] = set()
    unique: list[str] = []
    for name in filenames:
        safe = Path(name).name.replace("..", "_") or "file"
        if safe not in used:
            used.add(safe)
            unique.append(safe)
            continue
        path = Path(safe)
        stem = path.stem or "file"
        suffix = path.suffix
        n = 2
        while True:
            candidate = f"{stem} ({n}){suffix}"
            if candidate not in used:
                used.add(candidate)
                unique.append(candidate)
                break
            n += 1
    return unique


def save_tz_analysis_files(
    analysis_id: uuid.UUID,
    tz_path: Path,
    kp_paths: list[Path],
) -> tuple[Path, list[Path]]:
    """Copy uploaded files into upload_dir for background processing."""
    dest = tz_analysis_dir(analysis_id)
    dest.mkdir(parents=True, exist_ok=True)

    tz_dest = dest / f"tz{tz_path.suffix.lower()}"
    shutil.copy2(tz_path, tz_dest)

    kp_dests: list[Path] = []
    for idx, kp_path in enumerate(kp_paths, start=1):
        kp_dest = dest / f"kp{idx}{kp_path.suffix.lower()}"
        shutil.copy2(kp_path, kp_dest)
        kp_dests.append(kp_dest)

    return tz_dest, kp_dests


def _sort_kp_paths(paths: list[Path]) -> list[Path]:
    def sort_key(p: Path) -> tuple[int, str]:
        name = p.name.lower()
        if name.startswith("kp") and len(name) > 2 and name[2:3].isdigit():
            num_part = ""
            for ch in name[2:]:
                if ch.isdigit():
                    num_part += ch
                else:
                    break
            if num_part:
                return (int(num_part), name)
        return (0, name)

    return sorted(paths, key=sort_key)


def resolve_tz_analysis_files(
    analysis_id: uuid.UUID,
) -> tuple[Path, list[Path]] | None:
    """Return TZ path and KP paths if TZ and at least one KP exist."""
    dest = tz_analysis_dir(analysis_id)

    if not dest.is_dir():
        return None

    tz_files = sorted(dest.glob("tz*"))
    kp_files = _sort_kp_paths(list(dest.glob("kp*")))

    if not tz_files or not kp_files:
        return None

    return tz_files[0], kp_files
