# app/calculator.py
"""
Pollution-index calculation functions.

Changes from v1:
- Input validation (negative values, NaN/Inf handling)
- PERMISSIBLE_VALUES exported as a public constant
- Full type hints
- Pure-function design (accepts dict-like rows; still works with pd.Series)
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, Mapping, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# ── Public Constants ────────────────────────────────────────────────────
# Standard Permissible Values (S_i) in µg/L — based on WHO guidelines.
PERMISSIBLE_VALUES: Dict[str, int] = {
    "arsenic": 10,
    "cadmium": 3,
    "lead": 10,
    "zinc": 5000,
}

# Unit Weightage (W_i) = 1 / S_i
UNIT_WEIGHTAGE: Dict[str, float] = {
    metal: 1.0 / value for metal, value in PERMISSIBLE_VALUES.items()
}


# ── Helpers ─────────────────────────────────────────────────────────────
def _safe_value(row: Mapping[str, Any], key: str) -> float | None:
    """Return a valid non-negative finite float, or None."""
    if key not in row:
        return None
    val = row[key]
    # pandas NaN check (works for plain floats too)
    if val is None or (isinstance(val, float) and (math.isnan(val) or math.isinf(val))):
        return None
    # Also handle pandas NA-likes
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    val = float(val)
    if val < 0:
        logger.warning("Negative %s value (%.4f) clamped to 0", key, val)
        return 0.0
    return val


# ── Public API ──────────────────────────────────────────────────────────
def calculate_hpi(row: Mapping[str, Any]) -> Tuple[float, str]:
    """
    Heavy Metal Pollution Index (HPI).

    Weighted arithmetic mean of sub-index values.
    Returns ``(hpi_value, category_string)``.
    """
    numerator: float = 0.0
    denominator: float = 0.0

    for metal, weight in UNIT_WEIGHTAGE.items():
        concentration = _safe_value(row, metal)
        if concentration is None:
            continue
        standard_value = PERMISSIBLE_VALUES[metal]
        sub_index = (concentration / standard_value) * 100
        numerator += sub_index * weight
        denominator += weight

    if denominator == 0:
        return 0.0, "No Data"

    hpi_value = numerator / denominator

    if hpi_value < 100:
        category = "Low pollution"
    elif hpi_value < 150:
        category = "Moderate pollution"
    else:
        category = "High pollution"

    return round(hpi_value, 2), category


def calculate_degree_of_contamination(row: Mapping[str, Any]) -> Tuple[float, str]:
    """
    Degree of Contamination (Cd).

    Sum of contamination factors for each metal.
    Returns ``(cd_value, category_string)``.
    """
    cd_value: float = 0.0

    for metal, standard_value in PERMISSIBLE_VALUES.items():
        concentration = _safe_value(row, metal)
        if concentration is None:
            continue
        cd_value += concentration / standard_value

    if cd_value < 1:
        category = "Low degree of contamination"
    elif cd_value < 3:
        category = "Moderate degree of contamination"
    else:
        category = "High degree of contamination"

    return round(cd_value, 2), category