"""Object-by-object comparison of a TZ with a supplier's commercial offer."""

from __future__ import annotations

from backend.services.kp_compare.calls import ModelAccessError
from backend.services.kp_compare.pipeline import (
    ComparisonFailedError,
    run_kp_comparison,
)

__all__ = ["ComparisonFailedError", "ModelAccessError", "run_kp_comparison"]
